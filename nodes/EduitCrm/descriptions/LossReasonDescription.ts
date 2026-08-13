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
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: true,
		displayOptions: { show: SHOW },
		description:
			'Whether to return every matching deal. The API pages at 1000 items; this walks all pages. Turn off to cap the result with Limit.',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1 },
		displayOptions: { show: { ...SHOW, returnAll: [false] } },
		description: 'Max number of deals to return',
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
					'Somente negócios perdidos a partir desta data (Deal.closedAt — data da perda, não da criação). Vazio = sem limite inferior.',
			},
			{
				displayName: 'Lost To',
				name: 'to',
				type: 'dateTime',
				default: '',
				description:
					'Somente negócios perdidos até esta data (Deal.closedAt — data da perda, não da criação). Vazio = sem limite superior.',
			},
			{
				displayName: 'Created From',
				name: 'createdFrom',
				type: 'dateTime',
				default: '',
				description:
					'Somente negócios criados a partir desta data (Deal.createdAt). Equivale ao filtro "criados em" do /pipeline.',
			},
			{
				displayName: 'Created To',
				name: 'createdTo',
				type: 'dateTime',
				default: '',
				description:
					'Somente negócios criados até esta data (Deal.createdAt). Equivale ao filtro "criados em" do /pipeline.',
			},
		],
	},
];
