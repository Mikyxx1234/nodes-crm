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
	getPipelines,
	getStages,
	pruneEmpty,
	resolveStageId,
} from './GenericFunctions';
import {
	contactFields,
	contactOperations,
	dealContactFields,
	dealContactOperations,
	dealFields,
	dealOperations,
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
		const qs = pruneEmpty(filters);
		const res = (await eduitApiRequest.call(this, 'GET', '/api/contacts', {}, qs)) as IDataObject;
		return (res.items as IDataObject[]) ?? [res];
	}

	if (operation === 'create') {
		const name = this.getNodeParameter('name', i) as string;
		const additional = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const body = pruneEmpty({ name, ...additional });
		return (await eduitApiRequest.call(this, 'POST', '/api/contacts', body)) as IDataObject;
	}

	if (operation === 'update') {
		const contactId = (this.getNodeParameter('contactId', i) as string).trim();
		if (!contactId) {
			throw new NodeOperationError(this.getNode(), 'Contact ID é obrigatório.', { itemIndex: i });
		}
		const updateFields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
		const body = pruneEmpty(updateFields);
		if (Object.keys(body).length === 0) {
			throw new NodeOperationError(this.getNode(), 'Informe ao menos um campo para atualizar.', {
				itemIndex: i,
			});
		}
		return (await eduitApiRequest.call(
			this,
			'PUT',
			`/api/contacts/${encodeURIComponent(contactId)}`,
			body,
		)) as IDataObject;
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
		return (await eduitApiRequest.call(this, 'POST', '/api/deals', body)) as IDataObject;
	}

	if (operation === 'update') {
		const dealId = (this.getNodeParameter('dealId', i) as string).trim();
		if (!dealId) {
			throw new NodeOperationError(this.getNode(), 'Deal ID é obrigatório.', { itemIndex: i });
		}
		const updateFields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
		const body = pruneEmpty(updateFields);
		if (Object.keys(body).length === 0) {
			throw new NodeOperationError(this.getNode(), 'Informe ao menos um campo para atualizar.', {
				itemIndex: i,
			});
		}
		return (await eduitApiRequest.call(
			this,
			'PUT',
			`/api/deals/${encodeURIComponent(dealId)}`,
			body,
		)) as IDataObject;
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

	const body: IDataObject = { contact, deal };
	// Resposta real do backend: { contact, contactCreated, deal, dealCreated, missingCustomFields? }
	return (await eduitApiRequest.call(this, 'POST', '/api/leads', body)) as IDataObject;
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
