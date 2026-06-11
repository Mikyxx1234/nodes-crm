import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

type EduitContext = IExecuteFunctions | ILoadOptionsFunctions;

/**
 * Wrapper único para todas as chamadas à API do CRM. Usa o helper de
 * autenticação do n8n (injeta o Bearer da credencial eduitCrmApi) e normaliza
 * a baseUrl removendo barras finais para evitar `//api/...`.
 */
export async function eduitApiRequest(
	this: EduitContext,
	method: IHttpRequestMethods,
	resourcePath: string,
	body: IDataObject = {},
	qs: IDataObject = {},
): Promise<any> {
	const credentials = await this.getCredentials('eduitCrmApi');
	const baseUrl = String(credentials.baseUrl ?? '').replace(/\/+$/, '');

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${resourcePath}`,
		qs,
		body,
		json: true,
	};

	// GET/DELETE não devem carregar corpo; idem quando o body está vazio.
	if (method === 'GET' || method === 'DELETE' || Object.keys(body).length === 0) {
		delete options.body;
	}
	if (Object.keys(qs).length === 0) {
		delete options.qs;
	}

	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'eduitCrmApi', options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

type RawPipeline = {
	id: string;
	name: string;
	stages?: Array<{ id: string; name: string }>;
};

/** Carrega os pipelines da org (GET /api/pipelines retorna um array direto). */
export async function getPipelines(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const response = (await eduitApiRequest.call(this, 'GET', '/api/pipelines')) as
		| RawPipeline[]
		| { items?: RawPipeline[] };
	const pipelines = Array.isArray(response) ? response : response.items ?? [];
	return pipelines.map((p) => ({ name: p.name, value: p.id }));
}

/**
 * Carrega os stages do pipeline selecionado. Depende do parâmetro `pipelineId`
 * do node (loadOptionsDependsOn). Como GET /api/pipelines já traz os stages
 * embutidos, reusamos a mesma resposta em vez de uma rota separada.
 */
export async function getStages(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const pipelineId = this.getNodeParameter('pipelineId', '') as string;
	const response = (await eduitApiRequest.call(this, 'GET', '/api/pipelines')) as
		| RawPipeline[]
		| { items?: RawPipeline[] };
	const pipelines = Array.isArray(response) ? response : response.items ?? [];

	const target = pipelineId
		? pipelines.find((p) => p.id === pipelineId)
		: undefined;
	const stages = target?.stages ?? [];
	return stages.map((s) => ({ name: s.name, value: s.id }));
}

type RawCustomField = { id: string; name: string; label?: string };

async function loadCustomFieldOptions(
	ctx: ILoadOptionsFunctions,
	entity: 'contact' | 'deal',
): Promise<INodePropertyOptions[]> {
	const response = (await eduitApiRequest.call(
		ctx,
		'GET',
		'/api/custom-fields',
		{},
		{ entity },
	)) as RawCustomField[] | { items?: RawCustomField[] };
	const fields = Array.isArray(response) ? response : response.items ?? [];
	return fields.map((f) => ({
		name: f.label && f.label.trim() ? `${f.label} (${f.name})` : f.name,
		value: f.id,
	}));
}

/** Campos personalizados de Contato (GET /api/custom-fields?entity=contact). */
export async function getContactCustomFields(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	return loadCustomFieldOptions(this, 'contact');
}

/** Campos personalizados de Negócio (GET /api/custom-fields?entity=deal). */
export async function getDealCustomFields(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	return loadCustomFieldOptions(this, 'deal');
}

/**
 * Lê uma fixedCollection de custom fields (`{ field: [{ fieldId, value }] }`)
 * e devolve `[{ fieldId, value }]` pronto para os endpoints de valores.
 * Mantém value como string (inclusive vazia, que limpa o campo no CRM) e
 * descarta entradas sem fieldId.
 */
export function readCustomFields(
	ctx: IExecuteFunctions,
	paramName: string,
	itemIndex: number,
): Array<{ fieldId: string; value: string }> {
	const coll = ctx.getNodeParameter(paramName, itemIndex, {}) as IDataObject;
	const rows = (coll.field as IDataObject[] | undefined) ?? [];
	const out: Array<{ fieldId: string; value: string }> = [];
	for (const row of rows) {
		const fieldId = row && row.fieldId ? String(row.fieldId).trim() : '';
		if (!fieldId) continue;
		const value = row.value === undefined || row.value === null ? '' : String(row.value);
		out.push({ fieldId, value });
	}
	return out;
}

/**
 * Monta um objeto somente com os campos realmente preenchidos.
 *
 * Regra (definida no escopo): preserva `0` e `false`; descarta `undefined`,
 * `null` e string vazia/somente espaços. Útil em Update para não apagar
 * campos existentes ao enviar um valor "vazio" sem querer.
 */
export function pruneEmpty(input: IDataObject): IDataObject {
	const out: IDataObject = {};
	for (const [key, value] of Object.entries(input)) {
		if (value === undefined || value === null) continue;
		if (typeof value === 'string' && value.trim() === '') continue;
		out[key] = value;
	}
	return out;
}

/**
 * Resolve o valor de um stage considerando o fallback manual.
 * Quando o usuário escolhe "Informar ID manualmente", lê `stageIdManual`;
 * caso contrário usa o dropdown `stageId`.
 */
export function resolveStageId(ctx: IExecuteFunctions, itemIndex: number): string {
	const useManual = ctx.getNodeParameter('stageSource', itemIndex, 'list') === 'manual';
	const value = useManual
		? (ctx.getNodeParameter('stageIdManual', itemIndex, '') as string)
		: (ctx.getNodeParameter('stageId', itemIndex, '') as string);
	return (value ?? '').trim();
}
