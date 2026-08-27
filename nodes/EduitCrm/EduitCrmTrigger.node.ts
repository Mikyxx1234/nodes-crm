import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { eduitApiRequest } from './GenericFunctions';

const TRIGGER_EVENTS = [
	{
		name: 'Troca de Responsável do Negócio',
		value: 'agent_changed',
		description: 'Deal.ownerId mudou (edição, bulk, distribuição ou automação)',
	},
	{
		name: 'Troca de Responsável do Contato',
		value: 'contact_owner_changed',
		description: 'Contact.assignedToId mudou',
	},
	{
		name: 'Lead Distribuído',
		value: 'lead_distributed',
		description: 'Distribuição inteligente atribuiu um consultor',
	},
	{
		name: 'Estágio Alterado',
		value: 'stage_changed',
		description: 'Negócio mudou de coluna no funil',
	},
	{
		name: 'Negócio Criado',
		value: 'deal_created',
	},
	{
		name: 'Negócio Ganho',
		value: 'deal_won',
	},
	{
		name: 'Negócio Perdido',
		value: 'deal_lost',
	},
	{
		name: 'Contato Criado',
		value: 'contact_created',
	},
	{
		name: 'Tag Adicionada',
		value: 'tag_added',
	},
	{
		name: 'Conversação Criada',
		value: 'conversation_created',
	},
	{
		name: 'Ciclo de Vida Alterado',
		value: 'lifecycle_changed',
	},
	{
		name: 'Mensagem Recebida',
		value: 'message_received',
		description: 'Alto volume — filtra no workflow se não precisar de todo inbound',
	},
	{
		name: 'Mensagem Enviada',
		value: 'message_sent',
		description: 'Alto volume',
	},
];

type StoredWebhook = {
	id?: string;
	url?: string;
	events?: string[];
};

function readStored(staticData: IDataObject): StoredWebhook {
	const raw = staticData.webhook as IDataObject | undefined;
	if (!raw || typeof raw !== 'object') return {};
	return {
		id: typeof raw.id === 'string' ? raw.id : undefined,
		url: typeof raw.url === 'string' ? raw.url : undefined,
		events: Array.isArray(raw.events) ? raw.events.map(String) : undefined,
	};
}

function sameEvents(a: string[] | undefined, b: string[]): boolean {
	if (!a) return false;
	const left = [...a].sort();
	const right = [...b].sort();
	return left.length === right.length && left.every((v, i) => v === right[i]);
}

function selectedEvents(ctx: IHookFunctions): string[] {
	const listenAll = ctx.getNodeParameter('listenAll', false) as boolean;
	if (listenAll) return ['*'];
	const events = ctx.getNodeParameter('events', []) as string[];
	return events.filter((e) => typeof e === 'string' && e.trim() !== '');
}

/**
 * Trigger n8n: o CRM POSTa em um webhook registrado em
 * `/api/integration-webhooks` quando `fireTrigger` dispara o evento.
 * Requer o patch `backend-integration-webhooks.patch` aplicado no CRM.
 */
export class EduitCrmTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bwipo CRM Trigger',
		name: 'eduitCrmTrigger',
		icon: 'file:bwipo-icon-v2.png',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["listenAll"] ? "Todos os eventos" : $parameter["events"]}}',
		description:
			'Dispara o workflow quando um evento acontece no Bwipo CRM (troca de responsável, estágio, deal criado/ganho/perdido, …)',
		defaults: { name: 'Bwipo CRM Trigger' },
		inputs: [],
		outputs: ['main'],
		credentials: [{ name: 'eduitCrmApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName:
					'Requer o backend com webhooks de integração. Aplique backend-integration-webhooks.patch em caiovpinheiro/backend_crm1 e faça o deploy. Sem isso, ativar o workflow falha com 404 em /api/integration-webhooks.',
				name: 'backendNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Listen to All Events',
				name: 'listenAll',
				type: 'boolean',
				default: false,
				description:
					'Recebe qualquer evento que o CRM disparar (inclui chamadas e tabulação). Prefira selecionar eventos específicos.',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['agent_changed'],
				description: 'Eventos que disparam este workflow. Padrão: troca de responsável do negócio.',
				displayOptions: {
					show: {
						listenAll: [false],
					},
				},
				options: TRIGGER_EVENTS,
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				const stored = readStored(staticData);
				if (!stored.id) return false;

				const webhookUrl = this.getNodeWebhookUrl('default');
				const events = selectedEvents(this);

				try {
					const row = (await eduitApiRequest.call(
						this,
						'GET',
						`/api/integration-webhooks/${encodeURIComponent(stored.id)}`,
					)) as { id?: string; url?: string; events?: string[] };
					if (!row?.id) {
						delete staticData.webhook;
						return false;
					}
					const urlOk = !webhookUrl || !row.url || row.url === webhookUrl;
					if (urlOk && sameEvents(row.events, events)) {
						return true;
					}
					try {
						await eduitApiRequest.call(
							this,
							'DELETE',
							`/api/integration-webhooks/${encodeURIComponent(stored.id)}`,
						);
					} catch {
						// Recria no create().
					}
					delete staticData.webhook;
					return false;
				} catch {
					delete staticData.webhook;
					return false;
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				if (!webhookUrl) {
					throw new NodeOperationError(
						this.getNode(),
						'URL do webhook n8n indisponível. Ative o workflow e tente de novo.',
					);
				}

				const events = selectedEvents(this);
				if (events.length === 0) {
					throw new NodeOperationError(
						this.getNode(),
						'Selecione ao menos um evento (ou marque Listen to All Events).',
					);
				}

				const workflowName = this.getWorkflow().name ?? '';
				const body: IDataObject = {
					url: webhookUrl,
					events,
					name: workflowName ? `n8n: ${workflowName}`.slice(0, 200) : 'n8n',
				};

				let created: { id?: string; url?: string; events?: string[] };
				try {
					created = (await eduitApiRequest.call(
						this,
						'POST',
						'/api/integration-webhooks',
						body,
					)) as { id?: string; url?: string; events?: string[] };
				} catch (error) {
					const listed = await listWebhooksSafe(this);
					const existing = listed.find((h) => h.url === webhookUrl);
					if (!existing?.id) throw error;
					created = existing;
				}

				if (!created.id) {
					throw new NodeOperationError(
						this.getNode(),
						'O CRM criou o webhook mas não devolveu id. Confirme o patch backend-integration-webhooks.patch.',
					);
				}

				const staticData = this.getWorkflowStaticData('node');
				staticData.webhook = {
					id: created.id,
					url: webhookUrl,
					events,
				};
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				const stored = readStored(staticData);
				if (!stored.id) return true;
				try {
					await eduitApiRequest.call(
						this,
						'DELETE',
						`/api/integration-webhooks/${encodeURIComponent(stored.id)}`,
					);
				} catch {
					// Já removido no CRM ou patch ainda não aplicado.
				}
				delete staticData.webhook;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData();
		const payload =
			bodyData && typeof bodyData === 'object' ? (bodyData as IDataObject) : { raw: bodyData };
		return {
			workflowData: [this.helpers.returnJsonArray([payload])],
		};
	}
}

type ListedWebhook = { id?: string; url?: string; events?: string[] };

async function listWebhooksSafe(ctx: IHookFunctions): Promise<ListedWebhook[]> {
	try {
		const response = (await eduitApiRequest.call(ctx, 'GET', '/api/integration-webhooks')) as
			| ListedWebhook[]
			| { items?: ListedWebhook[] };
		return Array.isArray(response) ? response : response.items ?? [];
	} catch {
		return [];
	}
}
