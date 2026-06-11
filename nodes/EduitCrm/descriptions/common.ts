import type { INodeProperties } from 'n8n-workflow';

/** Valores reais do enum Prisma `DealStatus` (backend). */
export const DEAL_STATUS_OPTIONS: Array<{ name: string; value: string }> = [
	{ name: 'Open', value: 'OPEN' },
	{ name: 'Won', value: 'WON' },
	{ name: 'Lost', value: 'LOST' },
];

/** Valores reais do enum Prisma `LifecycleStage` (backend). */
export const LIFECYCLE_STAGE_OPTIONS: Array<{ name: string; value: string }> = [
	{ name: 'Subscriber', value: 'SUBSCRIBER' },
	{ name: 'Lead', value: 'LEAD' },
	{ name: 'MQL', value: 'MQL' },
	{ name: 'SQL', value: 'SQL' },
	{ name: 'Opportunity', value: 'OPPORTUNITY' },
	{ name: 'Customer', value: 'CUSTOMER' },
	{ name: 'Evangelist', value: 'EVANGELIST' },
	{ name: 'Other', value: 'OTHER' },
];

/**
 * Bloco Pipeline + Stage reutilizável, com fallback para ID manual.
 *
 * - `pipelineId`: dropdown (loadOptions getPipelines). Para `deal:search` ele
 *   também é enviado como filtro; nas demais operações serve só para filtrar
 *   o dropdown de stages.
 * - `stageSource`: escolhe entre dropdown ou ID manual (fallback caso a
 *   dependência dinâmica falhe no n8n).
 * - `stageId`: dropdown de stages (depende de pipelineId).
 * - `stageIdManual`: input livre de stage ID.
 *
 * `required` é validado no execute() (não no schema) porque varia por operação.
 */
export function stageSelector(
	resource: string,
	operation: string[],
	opts: { stageHint?: string; includeStage?: boolean } = {},
): INodeProperties[] {
	const includeStage = opts.includeStage !== false;
	const show = { resource: [resource], operation };

	const pipeline: INodeProperties = {
		displayName: 'Pipeline Name or ID',
		name: 'pipelineId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getPipelines' },
		default: '',
		description:
			'Pipeline do CRM. Escolha na lista ou use uma expressão. Necessário para listar os stages no dropdown abaixo.',
		displayOptions: { show },
	};

	if (!includeStage) return [pipeline];

	const stageSource: INodeProperties = {
		displayName: 'Stage Source',
		name: 'stageSource',
		type: 'options',
		options: [
			{ name: 'From List', value: 'list' },
			{ name: 'Enter Stage ID Manually', value: 'manual' },
		],
		default: 'list',
		description:
			'Como informar o stage. Use "Manual" se o dropdown dependente não carregar no seu n8n.',
		displayOptions: { show },
	};

	const stageList: INodeProperties = {
		displayName: 'Stage Name or ID',
		name: 'stageId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getStages', loadOptionsDependsOn: ['pipelineId'] },
		default: '',
		description: opts.stageHint ?? 'Stage (fase) do pipeline selecionado.',
		displayOptions: { show: { ...show, stageSource: ['list'] } },
	};

	const stageManual: INodeProperties = {
		displayName: 'Stage ID',
		name: 'stageIdManual',
		type: 'string',
		default: '',
		placeholder: 'clx123...',
		description: 'ID do stage informado manualmente.',
		displayOptions: { show: { ...show, stageSource: ['manual'] } },
	};

	return [pipeline, stageSource, stageList, stageManual];
}

/**
 * Coleção de campos personalizados (custom fields). Cada entrada tem o campo
 * (dropdown carregado da org) e o valor. Os valores são gravados via os
 * endpoints dedicados (`PUT /api/{contacts|deals}/:id/custom-fields`) ou
 * inline no `POST /api/leads`.
 *
 * @param name        nome do parâmetro (único por contexto, ex.: customFieldsUi)
 * @param entity      'contact' | 'deal' (define qual loadOptions usar)
 * @param resource    resource do node
 * @param operation   operações onde a coleção aparece
 * @param displayName rótulo exibido
 */
export function customFieldsCollection(
	name: string,
	entity: 'contact' | 'deal',
	resource: string,
	operation: string[],
	displayName = 'Custom Fields',
): INodeProperties {
	const loadOptionsMethod = entity === 'deal' ? 'getDealCustomFields' : 'getContactCustomFields';
	return {
		displayName,
		name,
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Custom Field',
		default: {},
		displayOptions: { show: { resource: [resource], operation } },
		options: [
			{
				displayName: 'Field',
				name: 'field',
				values: [
					{
						displayName: 'Field Name or ID',
						name: 'fieldId',
						type: 'options',
						typeOptions: { loadOptionsMethod },
						default: '',
						description:
							'Campo personalizado da organização. Carregado de GET /api/custom-fields.',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
					},
				],
			},
		],
	};
}
