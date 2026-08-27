import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class EduitCrmApi implements ICredentialType {
	name = 'eduitCrmApi';

	displayName = 'Bwipo CRM API';

	documentationUrl = 'https://github.com/Mikyxx1234';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'https://api.seu-crm.com',
			description:
				'URL base do CRM, sem barra no final. As rotas da API ficam sob /api (ex.: /api/contacts).',
		},
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Token de API gerado no CRM (formato eduit_...). A organização é resolvida automaticamente a partir do token.',
		},
	];

	// Injeta o Bearer em todas as requisições autenticadas do node.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
			},
		},
	};

	// Testa a credencial com uma chamada barata e somente-leitura.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/contacts',
			qs: { perPage: 1 },
		},
	};
}
