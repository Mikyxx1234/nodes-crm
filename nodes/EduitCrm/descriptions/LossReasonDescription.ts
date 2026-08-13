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
				name: 'Search',
				value: 'search',
				action: 'Search loss reasons',
				description:
					'Motivos de perda agregados (quantidade e valor total por motivo), com filtro opcional pela data em que o negócio foi perdido',
			},
		],
		default: 'search',
	},
];

const SHOW = { resource: ['lossReason'], operation: ['search'] };

export const lossReasonFields: INodeProperties[] = [
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
		],
	},
];
