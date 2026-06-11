import type { INodeProperties } from 'n8n-workflow';

import { customFieldsCollection, LIFECYCLE_STAGE_OPTIONS } from './common';

export const contactOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['contact'] } },
		options: [
			{
				name: 'Search',
				value: 'search',
				action: 'Search contacts',
				description: 'Busca contatos por termo, e-mail ou telefone',
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a contact',
				description: 'Cria um novo contato',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a contact',
				description: 'Atualiza um contato existente pelo ID',
			},
		],
		default: 'search',
	},
];

const contactCommonFields: INodeProperties[] = [
	{ displayName: 'Email', name: 'email', type: 'string', default: '', placeholder: 'nome@dominio.com' },
	{ displayName: 'Phone', name: 'phone', type: 'string', default: '', placeholder: '+55 11 99999-9999' },
	{
		displayName: 'Lifecycle Stage',
		name: 'lifecycleStage',
		type: 'options',
		options: LIFECYCLE_STAGE_OPTIONS,
		default: '',
	},
	{ displayName: 'Source', name: 'source', type: 'string', default: '', description: 'Origem do contato (ex.: form, anúncio, n8n)' },
	{ displayName: 'Lead Score', name: 'leadScore', type: 'number', default: 0 },
	{ displayName: 'Company ID', name: 'companyId', type: 'string', default: '' },
	{ displayName: 'Owner (Assigned To) ID', name: 'assignedToId', type: 'string', default: '', description: 'ID do usuário responsável. Dropdown indisponível nesta versão (GET /api/users não aceita token).' },
	{ displayName: 'Avatar URL', name: 'avatarUrl', type: 'string', default: '' },
];

export const contactFields: INodeProperties[] = [
	// ── Search ──
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['contact'], operation: ['search'] } },
		options: [
			{ displayName: 'Search Term', name: 'search', type: 'string', default: '', description: 'Busca textual em vários campos (nome, e-mail, telefone...)' },
			{ displayName: 'Email (Exact)', name: 'email', type: 'string', default: '', description: 'Match exato por e-mail (ideal para "existe?")' },
			{ displayName: 'Phone (Exact)', name: 'phone', type: 'string', default: '', description: 'Match exato por telefone (casa pelos dígitos)' },
			{
				displayName: 'Lifecycle Stage',
				name: 'lifecycleStage',
				type: 'options',
				options: LIFECYCLE_STAGE_OPTIONS,
				default: '',
			},
			{ displayName: 'Limit', name: 'perPage', type: 'number', typeOptions: { minValue: 1 }, default: 20, description: 'Máximo de resultados por página' },
			{ displayName: 'Page', name: 'page', type: 'number', typeOptions: { minValue: 1 }, default: 1 },
		],
	},

	// ── Create ──
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['contact'], operation: ['create'] } },
		description: 'Nome do contato (obrigatório)',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['contact'], operation: ['create'] } },
		options: contactCommonFields,
	},
	customFieldsCollection('customFieldsUi', 'contact', 'contact', ['create']),

	// ── Update ──
	{
		displayName: 'Contact ID',
		name: 'contactId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['contact'], operation: ['update'] } },
		description: 'ID do contato a atualizar',
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['contact'], operation: ['update'] } },
		options: [
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			...contactCommonFields,
		],
	},
	customFieldsCollection('customFieldsUi', 'contact', 'contact', ['update']),
];
