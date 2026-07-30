import type { INodeProperties } from 'n8n-workflow';

export const noteOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['note'] } },
		options: [
			{
				name: 'Create on Deal',
				value: 'createOnDeal',
				action: 'Create a note on a deal',
				description:
					'Cria uma nota vinculada a um negócio (Deal). A nota aparece tanto na aba "Notas" do deal em /pipeline quanto na timeline do /inbox (como nota interna) se o contato do deal tiver conversa vigente.',
			},
		],
		default: 'createOnDeal',
	},
];

const SHOW = { resource: ['note'], operation: ['createOnDeal'] };

export const noteFields: INodeProperties[] = [
	{
		displayName: 'Deal ID',
		name: 'dealId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: SHOW },
		description: 'ID do negócio ao qual a nota será vinculada',
	},
	{
		displayName: 'Content',
		name: 'content',
		type: 'string',
		required: true,
		default: '',
		typeOptions: { rows: 4 },
		displayOptions: { show: SHOW },
		description: 'Texto da nota (obrigatório, sem HTML)',
	},
];
