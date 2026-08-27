import type { INodeProperties } from 'n8n-workflow';

/** Tipos gravados em `activity_events` / `deal_events` (mesmos da timeline do deal no CRM). */
export const TIMELINE_EVENT_OPTIONS: Array<{ name: string; value: string; description?: string }> = [
	{ name: 'Todos os eventos', value: '*', description: 'Devolve a timeline inteira do negócio (até 200)' },
	{ name: 'Responsável alterado', value: 'OWNER_CHANGED' },
	{ name: 'Mensagem recebida', value: 'MESSAGE_RECEIVED' },
	{ name: 'Mensagem enviada', value: 'MESSAGE_SENT' },
	{ name: 'Mensagem lida', value: 'MESSAGE_READ' },
	{ name: 'Automação executada', value: 'AUTOMATION_EXECUTED' },
	{ name: 'Status alterado', value: 'STATUS_CHANGED', description: 'Aberto / Ganho / Perdido' },
	{ name: 'Estágio alterado', value: 'STAGE_CHANGED' },
	{ name: 'Negócio criado', value: 'CREATED' },
	{ name: 'Contato criado', value: 'CONTACT_CREATED' },
	{ name: 'Tag adicionada', value: 'TAG_ADDED' },
	{ name: 'Nota adicionada', value: 'NOTE_ADDED' },
	{ name: 'Campo alterado', value: 'FIELD_UPDATED' },
	{ name: 'Campo personalizado alterado', value: 'CUSTOM_FIELD_UPDATED' },
	{ name: 'Falha no envio', value: 'MESSAGE_FAILED' },
	{ name: 'Contato vinculado', value: 'CONTACT_LINKED' },
];

export const timelineOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['timeline'] } },
		options: [
			{
				name: 'Get Events',
				value: 'get',
				action: 'Get deal timeline events',
				description:
					'Lê a timeline do negócio (a mesma do painel do deal) e filtra pelo tipo de evento escolhido',
			},
		],
		default: 'get',
	},
];

const SHOW = { resource: ['timeline'], operation: ['get'] };

export const timelineFields: INodeProperties[] = [
	{
		displayName:
			'Requer o backend com Bearer em GET /api/deals/:id/timeline. Aplique backend-deal-timeline-bearer.patch em caiovpinheiro/backend_crm1 e faça o deploy. Sem isso a chamada falha com 401.',
		name: 'backendNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: SHOW },
	},
	{
		displayName: 'Deal ID',
		name: 'dealId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: SHOW },
		description: 'ID do negócio cuja timeline será lida. Tipicamente vem do Trigger (`{{$json.dealId}}`).',
	},
	{
		displayName: 'Event Type',
		name: 'eventType',
		type: 'options',
		required: true,
		default: 'OWNER_CHANGED',
		displayOptions: { show: SHOW },
		description: 'Tipo de evento da timeline do CRM. A lista segue os cartões do painel do negócio.',
		options: TIMELINE_EVENT_OPTIONS,
	},
	{
		displayName: 'Return All Matching',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: { show: SHOW },
		description:
			'Desligado: devolve só o evento mais recente daquele tipo (útil depois de um Trigger). Ligado: um item n8n por ocorrência.',
	},
];
