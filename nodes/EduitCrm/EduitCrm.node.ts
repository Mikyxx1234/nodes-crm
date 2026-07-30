import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	eduitApiRequest,
	getContactCustomFields,
	getDealCustomFields,
	getPipelines,
	getStages,
	pruneEmpty,
	readCustomFields,
	resolveStageId,
} from './GenericFunctions';
import {
	contactFields,
	contactOperations,
	dealContactFields,
	dealContactOperations,
	dealFields,
	dealOperations,
	noteFields,
	noteOperations,
	searchFields,
	searchOperations,
} from './descriptions';

export class EduitCrm implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Eduit CRM',
		name: 'eduitCrm',
		icon: 'file:eduitCrm.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Opera o Eduit CRM (contatos, negócios, deal+contato e busca)',
		defaults: { name: 'Eduit CRM' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'eduitCrmApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Deal + Contact', value: 'dealContact' },
					{ name: 'Contact', value: 'contact' },
					{ name: 'Deal', value: 'deal' },
					{ name: 'Note', value: 'note' },
					{ name: 'Search', value: 'search' },
				],
				default: 'dealContact',
			},
			...dealContactOperations,
			...dealContactFields,
			...contactOperations,
			...contactFields,
			...dealOperations,
			...dealFields,
			...noteOperations,
			...noteFields,
			...searchOperations,
			...searchFields,
		],
	};

	methods = {
		loadOptions: {
			getPipelines(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return getPipelines.call(this);
			},
			getStages(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return getStages.call(this);
			},
			getContactCustomFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return getContactCustomFields.call(this);
			},
			getDealCustomFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return getDealCustomFields.call(this);
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let result: IDataObject | IDataObject[] | undefined;

				if (resource === 'contact') {
					result = await handleContact.call(this, operation, i);
				} else if (resource === 'deal') {
					result = await handleDeal.call(this, operation, i);
				} else if (resource === 'dealContact') {
					result = await handleDealContact.call(this, operation, i);
				} else if (resource === 'note') {
					result = await handleNote.call(this, operation, i);
				} else if (resource === 'search') {
					result = await handleSearch.call(this, operation, i);
				} else {
					throw new NodeOperationError(this.getNode(), `Resource não suportado: ${resource}`);
				}

				const rows = Array.isArray(result) ? result : [result ?? {}];
				for (const row of rows) {
					returnData.push({ json: row, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

// ──────────────────────────────────────────────
// Handlers por resource
// ──────────────────────────────────────────────

async function handleContact(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject | IDataObject[]> {
	if (operation === 'search') {
		const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
		// `includeDeals` é sinalizador do node — não é filtro do backend.
		// Removido do qs para não virar querystring sem efeito (e não
		// confundir logs de acesso na API).
		const includeDeals = filters.includeDeals === true;
		const qs = pruneEmpty({ ...filters, includeDeals: undefined });
		const res = (await eduitApiRequest.call(this, 'GET', '/api/contacts', {}, qs)) as IDataObject;
		const contacts = (res.items as IDataObject[]) ?? [];

		if (!includeDeals) return contacts.length > 0 ? contacts : [res];

		// Enriquecimento opcional: para cada contato, busca os deals
		// vinculados via GET /api/deals?contactId=... (mesmo padrão do
		// Search > Search Full Record). Serial para preservar o rate
		// limit da API — a lista de retorno costuma ser pequena (perPage
		// padrão 20). Se precisar mais throughput no futuro, dá para
		// paralelizar com Promise.all.
		const enriched: IDataObject[] = [];
		for (const contact of contacts) {
			let deals: IDataObject[] = [];
			if (contact.id) {
				const dealsRes = (await eduitApiRequest.call(
					this,
					'GET',
					'/api/deals',
					{},
					{ contactId: contact.id as string, perPage: 100 },
				)) as IDataObject;
				deals = ((dealsRes.items as IDataObject[]) ?? []) as IDataObject[];
			}
			enriched.push({ ...contact, deals });
		}
		return enriched;
	}

	if (operation === 'create') {
		const name = this.getNodeParameter('name', i) as string;
		const additional = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const body = pruneEmpty({ name, ...additional });
		const created = (await eduitApiRequest.call(
			this,
			'POST',
			'/api/contacts',
			body,
		)) as IDataObject;

		const customFields = readCustomFields(this, 'customFieldsUi', i);
		if (customFields.length > 0 && created.id) {
			created.customFields = await eduitApiRequest.call(
				this,
				'PUT',
				`/api/contacts/${encodeURIComponent(String(created.id))}/custom-fields`,
				{ values: customFields },
			);
		}
		return created;
	}

	if (operation === 'update') {
		const contactId = (this.getNodeParameter('contactId', i) as string).trim();
		if (!contactId) {
			throw new NodeOperationError(this.getNode(), 'Contact ID é obrigatório.', { itemIndex: i });
		}
		const updateFields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
		const body = pruneEmpty(updateFields);
		const customFields = readCustomFields(this, 'customFieldsUi', i);

		if (Object.keys(body).length === 0 && customFields.length === 0) {
			throw new NodeOperationError(this.getNode(), 'Informe ao menos um campo para atualizar.', {
				itemIndex: i,
			});
		}

		let result: IDataObject = {};
		if (Object.keys(body).length > 0) {
			result = (await eduitApiRequest.call(
				this,
				'PUT',
				`/api/contacts/${encodeURIComponent(contactId)}`,
				body,
			)) as IDataObject;
		}
		if (customFields.length > 0) {
			result.customFields = await eduitApiRequest.call(
				this,
				'PUT',
				`/api/contacts/${encodeURIComponent(contactId)}/custom-fields`,
				{ values: customFields },
			);
		}
		return result;
	}

	throw new NodeOperationError(this.getNode(), `Operação de contato não suportada: ${operation}`);
}

async function handleDeal(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject | IDataObject[]> {
	if (operation === 'search') {
		const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
		const pipelineId = (this.getNodeParameter('pipelineId', i, '') as string).trim();
		const stageId = resolveStageId(this, i);
		const qs = pruneEmpty({ ...filters, pipelineId, stageId });
		const res = (await eduitApiRequest.call(this, 'GET', '/api/deals', {}, qs)) as IDataObject;
		return (res.items as IDataObject[]) ?? [res];
	}

	if (operation === 'create') {
		const title = this.getNodeParameter('title', i) as string;
		const stageId = resolveStageId(this, i);
		if (!stageId) {
			throw new NodeOperationError(this.getNode(), 'Stage é obrigatório para criar um negócio.', {
				itemIndex: i,
			});
		}
		const additional = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const body = pruneEmpty({ title, stageId, ...additional });
		const created = (await eduitApiRequest.call(this, 'POST', '/api/deals', body)) as IDataObject;

		const customFields = readCustomFields(this, 'customFieldsUi', i);
		if (customFields.length > 0 && created.id) {
			created.customFields = await eduitApiRequest.call(
				this,
				'PUT',
				`/api/deals/${encodeURIComponent(String(created.id))}/custom-fields`,
				{ values: customFields },
			);
		}
		return created;
	}

	if (operation === 'update') {
		const dealId = (this.getNodeParameter('dealId', i) as string).trim();
		if (!dealId) {
			throw new NodeOperationError(this.getNode(), 'Deal ID é obrigatório.', { itemIndex: i });
		}
		const updateFields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
		const body = pruneEmpty(updateFields);
		const customFields = readCustomFields(this, 'customFieldsUi', i);

		if (Object.keys(body).length === 0 && customFields.length === 0) {
			throw new NodeOperationError(this.getNode(), 'Informe ao menos um campo para atualizar.', {
				itemIndex: i,
			});
		}

		let result: IDataObject = {};
		if (Object.keys(body).length > 0) {
			result = (await eduitApiRequest.call(
				this,
				'PUT',
				`/api/deals/${encodeURIComponent(dealId)}`,
				body,
			)) as IDataObject;
		}
		if (customFields.length > 0) {
			result.customFields = await eduitApiRequest.call(
				this,
				'PUT',
				`/api/deals/${encodeURIComponent(dealId)}/custom-fields`,
				{ values: customFields },
			);
		}
		return result;
	}

	if (operation === 'moveStage') {
		const dealId = (this.getNodeParameter('dealId', i) as string).trim();
		if (!dealId) {
			throw new NodeOperationError(this.getNode(), 'Deal ID é obrigatório.', { itemIndex: i });
		}
		const stageId = resolveStageId(this, i);
		if (!stageId) {
			throw new NodeOperationError(this.getNode(), 'Stage é obrigatório para mover o negócio.', {
				itemIndex: i,
			});
		}
		const position = this.getNodeParameter('position', i, 0) as number;
		// Usa PUT /api/deals/:id (aceita Bearer). Não usar /move (só sessão).
		const body: IDataObject = { stageId, position };
		return (await eduitApiRequest.call(
			this,
			'PUT',
			`/api/deals/${encodeURIComponent(dealId)}`,
			body,
		)) as IDataObject;
	}

	throw new NodeOperationError(this.getNode(), `Operação de negócio não suportada: ${operation}`);
}

async function handleDealContact(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	if (operation !== 'createWithContact') {
		throw new NodeOperationError(this.getNode(), `Operação não suportada: ${operation}`);
	}

	const contactName = this.getNodeParameter('contactName', i, '') as string;
	const contactEmail = this.getNodeParameter('contactEmail', i, '') as string;
	const contactPhone = this.getNodeParameter('contactPhone', i, '') as string;
	const contactExtra = this.getNodeParameter('contactExtra', i, {}) as IDataObject;

	const contact = pruneEmpty({
		name: contactName,
		email: contactEmail,
		phone: contactPhone,
		...contactExtra,
	});

	// Precisa de algo para localizar/criar: id, telefone, e-mail ou nome.
	if (!contact.id && !contact.phone && !contact.email && !contact.name) {
		throw new NodeOperationError(
			this.getNode(),
			'Informe ao menos um identificador do contato (ID, telefone, e-mail) ou o nome para criar.',
			{ itemIndex: i },
		);
	}

	const stageId = resolveStageId(this, i);
	if (!stageId) {
		throw new NodeOperationError(this.getNode(), 'Stage é obrigatório (Create Deal With Contact).', {
			itemIndex: i,
		});
	}
	const dealTitle = this.getNodeParameter('dealTitle', i, '') as string;
	const dealExtra = this.getNodeParameter('dealExtra', i, {}) as IDataObject;
	const deal = pruneEmpty({ stageId, title: dealTitle, ...dealExtra });

	// Custom fields vão inline no /api/leads (resolve por fieldId). O backend
	// aceita [{ fieldId, value }] tanto no bloco contact quanto no deal.
	const contactCf = readCustomFields(this, 'contactCustomFieldsUi', i);
	if (contactCf.length > 0) contact.customFields = contactCf;
	const dealCf = readCustomFields(this, 'dealCustomFieldsUi', i);
	if (dealCf.length > 0) deal.customFields = dealCf;

	const body: IDataObject = { contact, deal };
	// Resposta real do backend: { contact, contactCreated, deal, dealCreated, missingCustomFields? }
	return (await eduitApiRequest.call(this, 'POST', '/api/leads', body)) as IDataObject;
}

async function handleNote(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	if (operation !== 'createOnDeal') {
		throw new NodeOperationError(this.getNode(), `Operação de nota não suportada: ${operation}`);
	}

	const dealId = (this.getNodeParameter('dealId', i) as string).trim();
	if (!dealId) {
		throw new NodeOperationError(this.getNode(), 'Deal ID é obrigatório.', { itemIndex: i });
	}
	const content = (this.getNodeParameter('content', i) as string).trim();
	if (!content) {
		throw new NodeOperationError(this.getNode(), 'Conteúdo da nota é obrigatório.', { itemIndex: i });
	}

	// POST /api/deals/:id/notes — após o ajuste 30/jul/26 no backend, cria
	// o `Note` (aparece em /pipeline) e, se o contato do deal tem conversa
	// vigente, cria também uma `Message` messageType=note isPrivate=true
	// (aparece em /inbox). Escopo por org é garantido pelo Bearer token.
	return (await eduitApiRequest.call(
		this,
		'POST',
		`/api/deals/${encodeURIComponent(dealId)}/notes`,
		{ content },
	)) as IDataObject;
}

async function handleSearch(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	if (operation !== 'fullRecord') {
		throw new NodeOperationError(this.getNode(), `Operação não suportada: ${operation}`);
	}

	const searchBy = this.getNodeParameter('searchBy', i, 'term') as string;
	const value = (this.getNodeParameter('value', i) as string).trim();
	const options = this.getNodeParameter('options', i, {}) as IDataObject;
	if (!value) {
		throw new NodeOperationError(this.getNode(), 'Informe um valor para busca.', { itemIndex: i });
	}

	const perPage = (options.perPage as number) ?? 20;
	const includeDeals = options.includeDeals !== false;

	const qs: IDataObject = { perPage };
	if (searchBy === 'email') qs.email = value;
	else if (searchBy === 'phone') qs.phone = value;
	else if (searchBy === 'adSourceId') qs.adSourceId = value;
	else qs.search = value;

	const contactsRes = (await eduitApiRequest.call(
		this,
		'GET',
		'/api/contacts',
		{},
		qs,
	)) as IDataObject;
	const contacts = ((contactsRes.items as IDataObject[]) ?? []) as IDataObject[];

	const results: IDataObject[] = [];
	const allDeals: IDataObject[] = [];
	for (const contact of contacts) {
		let deals: IDataObject[] = [];
		if (includeDeals && contact.id) {
			const dealsRes = (await eduitApiRequest.call(
				this,
				'GET',
				'/api/deals',
				{},
				{ contactId: contact.id as string, perPage: 100 },
			)) as IDataObject;
			deals = ((dealsRes.items as IDataObject[]) ?? []) as IDataObject[];
			allDeals.push(...deals);
		}
		results.push({ contact, deals });
	}

	// Não escolhe silenciosamente: retorna todos. mainContact/mainDeal são
	// apenas atalhos para o primeiro resultado (útil quando há 1 match claro).
	const mainContact = contacts.length > 0 ? contacts[0] : null;
	const mainDeal = allDeals.length > 0 ? allDeals[0] : null;

	return {
		query: { searchBy, value },
		totalContacts: contacts.length,
		totalDeals: allDeals.length,
		results,
		mainContact,
		mainDeal,
	};
}
