import type { INodeProperties } from 'n8n-workflow';

import {
	customFieldsCollection,
	DEAL_STATUS_OPTIONS,
	LIFECYCLE_STAGE_OPTIONS,
	stageSelector,
} from './common';

export const dealContactOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['dealContact'] } },
		options: [
			{
				name: 'Create Deal With Contact',
				value: 'createWithContact',
				action: 'Create a deal with contact',
				description:
					'Acha o contato (por ID, telefone ou e-mail) ou cria, e cria o negócio já vinculado (POST /api/leads)',
			},
		],
		default: 'createWithContact',
	},
];

const SHOW = { resource: ['dealContact'], operation: ['createWithContact'] };

export const dealContactFields: INodeProperties[] = [
	// ── Identificação do contato ──
	{
		displayName: 'Contact Name',
		name: 'contactName',
		type: 'string',
		default: '',
		displayOptions: { show: SHOW },
		description:
			'Nome do contato. Obrigatório quando o contato ainda não existe (será criado). Se já existir por telefone/e-mail, é opcional.',
	},
	{
		displayName: 'Contact Email',
		name: 'contactEmail',
		type: 'string',
		default: '',
		placeholder: 'nome@dominio.com',
		displayOptions: { show: SHOW },
		description: 'Usado para localizar o contato existente; se não achar, entra no novo contato',
	},
	{
		displayName: 'Contact Phone',
		name: 'contactPhone',
		type: 'string',
		default: '',
		placeholder: '+55 11 99999-9999',
		displayOptions: { show: SHOW },
		description: 'Usado para localizar o contato existente (match por dígitos); senão entra no novo contato',
	},
	{
		displayName: 'Contact Additional Fields',
		name: 'contactExtra',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: SHOW },
		options: [
			{ displayName: 'Contact ID', name: 'id', type: 'string', default: '', description: 'Força o uso de um contato específico (tem prioridade sobre telefone/e-mail)' },
			{ displayName: 'Lifecycle Stage', name: 'lifecycleStage', type: 'options', options: LIFECYCLE_STAGE_OPTIONS, default: '' },
			{ displayName: 'Source', name: 'source', type: 'string', default: '', description: 'Origem do lead (form, anúncio, etc.)' },
			{ displayName: 'Lead Score', name: 'leadScore', type: 'number', default: 0 },
			{ displayName: 'Company ID', name: 'companyId', type: 'string', default: '' },
			{ displayName: 'Owner (Assigned To) ID', name: 'assignedToId', type: 'string', default: '' },
			{ displayName: 'Avatar URL', name: 'avatarUrl', type: 'string', default: '' },
		],
	},
	customFieldsCollection(
		'contactCustomFieldsUi',
		'contact',
		'dealContact',
		['createWithContact'],
		'Contact Custom Fields',
	),

	// ── Negócio ──
	...stageSelector('dealContact', ['createWithContact'], {
		stageHint: 'Stage onde o negócio será criado (obrigatório).',
	}),
	{
		displayName: 'Deal Title',
		name: 'dealTitle',
		type: 'string',
		default: '',
		displayOptions: { show: SHOW },
		description: 'Título do negócio. Se vazio, o backend usa "Lead - {nome do contato}".',
	},
	{
		displayName: 'Deal Additional Fields',
		name: 'dealExtra',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: SHOW },
		options: [
			{ displayName: 'Value', name: 'value', type: 'number', default: 0 },
			{ displayName: 'Status', name: 'status', type: 'options', options: DEAL_STATUS_OPTIONS, default: 'OPEN' },
			{ displayName: 'Expected Close', name: 'expectedClose', type: 'dateTime', default: '' },
			{ displayName: 'Owner ID', name: 'ownerId', type: 'string', default: '' },
			{ displayName: 'Position', name: 'position', type: 'number', typeOptions: { minValue: 0 }, default: 0 },
		],
	},
	customFieldsCollection(
		'dealCustomFieldsUi',
		'deal',
		'dealContact',
		['createWithContact'],
		'Deal Custom Fields',
	),

	// ── Proteções contra reprocessamento ──
	{
		displayName: 'Avoid Duplicate Deal',
		name: 'reuseOpenDeal',
		type: 'boolean',
		default: true,
		displayOptions: { show: SHOW },
		description:
			'Whether to reuse the contact\'s open deal in the same pipeline instead of creating another one. Protects against duplicated items, retries and re-runs.',
	},
	{
		displayName: 'Only Fill Empty Contact Fields',
		name: 'fillEmptyContactFieldsOnly',
		type: 'boolean',
		default: true,
		displayOptions: { show: SHOW },
		description:
			'Whether to keep values already filled in an existing contact, writing only into blank fields. Prevents a later run from overwriting a phone or name that is already correct.',
	},
];
