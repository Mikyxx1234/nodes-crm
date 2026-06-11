import type { INodeProperties } from 'n8n-workflow';

import { DEAL_STATUS_OPTIONS, stageSelector } from './common';

export const dealOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['deal'] } },
		options: [
			{
				name: 'Search',
				value: 'search',
				action: 'Search deals',
				description: 'Busca negócios por pipeline, stage, status, dono ou contato',
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a deal',
				description: 'Cria um novo negócio',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a deal',
				description: 'Atualiza um negócio existente pelo ID',
			},
			{
				name: 'Move Stage',
				value: 'moveStage',
				action: 'Move a deal to another stage',
				description: 'Move o negócio para outro stage (via PUT /api/deals/:id)',
			},
		],
		default: 'search',
	},
];

export const dealFields: INodeProperties[] = [
	// ── Title (create) ──
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['deal'], operation: ['create'] } },
		description: 'Título do negócio (obrigatório)',
	},

	// ── Deal ID (update / moveStage) ──
	{
		displayName: 'Deal ID',
		name: 'dealId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['deal'], operation: ['update', 'moveStage'] } },
		description: 'ID do negócio',
	},

	// ── Pipeline + Stage (create obrigatório, moveStage obrigatório, search filtro) ──
	...stageSelector('deal', ['create', 'moveStage', 'search']),

	// ── Position (moveStage / create opcional) ──
	{
		displayName: 'Position',
		name: 'position',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 0,
		displayOptions: { show: { resource: ['deal'], operation: ['moveStage'] } },
		description: 'Posição do card dentro do stage (0 = topo)',
	},

	// ── Create (additional) ──
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['deal'], operation: ['create'] } },
		options: [
			{ displayName: 'Value', name: 'value', type: 'number', default: 0 },
			{ displayName: 'Status', name: 'status', type: 'options', options: DEAL_STATUS_OPTIONS, default: 'OPEN' },
			{ displayName: 'Expected Close', name: 'expectedClose', type: 'dateTime', default: '' },
			{ displayName: 'Contact ID', name: 'contactId', type: 'string', default: '', description: 'Vincula o negócio a um contato existente' },
			{ displayName: 'Owner ID', name: 'ownerId', type: 'string', default: '', description: 'ID do usuário dono. Dropdown indisponível nesta versão.' },
			{ displayName: 'Position', name: 'position', type: 'number', typeOptions: { minValue: 0 }, default: 0 },
			{ displayName: 'Lost Reason', name: 'lostReason', type: 'string', default: '' },
		],
	},

	// ── Update ──
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['deal'], operation: ['update'] } },
		options: [
			{ displayName: 'Title', name: 'title', type: 'string', default: '' },
			{ displayName: 'Value', name: 'value', type: 'number', default: 0 },
			{ displayName: 'Status', name: 'status', type: 'options', options: DEAL_STATUS_OPTIONS, default: 'OPEN' },
			{ displayName: 'Expected Close', name: 'expectedClose', type: 'dateTime', default: '' },
			{ displayName: 'Contact ID', name: 'contactId', type: 'string', default: '' },
			{ displayName: 'Owner ID', name: 'ownerId', type: 'string', default: '' },
			{ displayName: 'Position', name: 'position', type: 'number', typeOptions: { minValue: 0 }, default: 0 },
			{ displayName: 'Lost Reason', name: 'lostReason', type: 'string', default: '' },
		],
	},

	// ── Search (filtros adicionais; pipeline/stage vêm do bloco acima) ──
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['deal'], operation: ['search'] } },
		options: [
			{ displayName: 'Search Term', name: 'search', type: 'string', default: '' },
			{ displayName: 'Status', name: 'status', type: 'options', options: DEAL_STATUS_OPTIONS, default: 'OPEN' },
			{ displayName: 'Owner ID', name: 'ownerId', type: 'string', default: '' },
			{ displayName: 'Contact ID', name: 'contactId', type: 'string', default: '' },
			{ displayName: 'Contact Email', name: 'contactEmail', type: 'string', default: '' },
			{ displayName: 'Contact Phone', name: 'contactPhone', type: 'string', default: '' },
			{ displayName: 'Limit', name: 'perPage', type: 'number', typeOptions: { minValue: 1 }, default: 20 },
			{ displayName: 'Page', name: 'page', type: 'number', typeOptions: { minValue: 1 }, default: 1 },
		],
	},
];
