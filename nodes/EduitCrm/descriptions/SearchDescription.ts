import type { INodeProperties } from 'n8n-workflow';

export const searchOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['search'] } },
		options: [
			{
				name: 'Search Full Record',
				value: 'fullRecord',
				action: 'Search a full record',
				description:
					'Busca contatos e, para cada um, os negócios vinculados. Retorna todos os resultados + mainContact/mainDeal',
			},
		],
		default: 'fullRecord',
	},
];

const SHOW = { resource: ['search'], operation: ['fullRecord'] };

export const searchFields: INodeProperties[] = [
	{
		displayName: 'Search By',
		name: 'searchBy',
		type: 'options',
		default: 'term',
		displayOptions: { show: SHOW },
		options: [
			{ name: 'General Term', value: 'term', description: 'Busca textual ampla (nome, e-mail, telefone...)' },
			{ name: 'Email (Exact)', value: 'email' },
			{ name: 'Phone (Exact)', value: 'phone' },
		],
	},
	{
		displayName: 'Value',
		name: 'value',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: SHOW },
		description: 'Valor a buscar (termo, e-mail ou telefone, conforme "Search By")',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: SHOW },
		options: [
			{ displayName: 'Max Contacts', name: 'perPage', type: 'number', typeOptions: { minValue: 1 }, default: 20, description: 'Máximo de contatos retornados' },
			{ displayName: 'Include Deals', name: 'includeDeals', type: 'boolean', default: true, description: 'Whether to also fetch the deals linked to each contact' },
		],
	},
];
