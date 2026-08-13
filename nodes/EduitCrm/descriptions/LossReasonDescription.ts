import type { INodeProperties } from 'n8n-workflow';

export const lossReasonOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['lossReason'] } },
		options: [
			{
				name: 'Search Deals',
				value: 'searchDeals',
				action: 'Search lost deals by loss reason',
				description:
					'Lista os negócios perdidos (status LOST), com filtro opcional por motivo de perda e pela data em que foram perdidos',
			},
		],
		default: 'searchDeals',
	},
];

const SHOW = { resource: ['lossReason'], operation: ['searchDeals'] };

export const lossReasonFields: INodeProperties[] = [
	{
		displayName: 'Loss Reason',
		name: 'lossReason',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getLossReasons' },
		default: '',
		displayOptions: { show: SHOW },
		description:
			'Motivo de perda usado no CRM (lista carregada da organização). Vazio = negócios perdidos com qualquer motivo. Escolha na lista ou use uma expressão.',
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: SHOW },
		options: [
			{
				displayName: 'Lost From',
				name: 'from',
				type: 'dateTime',
				default: '',
				description:
					'Somente negócios perdidos a partir desta data (Deal.closedAt). Vazio = sem limite inferior.',
			},
			{
				displayName: 'Lost To',
				name: 'to',
				type: 'dateTime',
				default: '',
				description:
					'Somente negócios perdidos até esta data (Deal.closedAt). Vazio = sem limite superior.',
			},
			{
				displayName: 'Limit',
				name: 'perPage',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 20,
				description: 'Máximo de negócios retornados por página',
			},
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 1,
			},
		],
	},
];
