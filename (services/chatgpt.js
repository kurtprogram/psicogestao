const axios = require('axios');
require('dotenv').config();

class ChatGPTService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.apiUrl = 'https://api.openai.com/v1/chat/completions';
    }

    async getResponse(message, context = 'psychological_assistant') {
        try {
            const systemPrompts = {
                'psychological_assistant': `Você é um assistente virtual especializado em psicologia. 
                Sua função é ajudar psicólogos com questões relacionadas à prática clínica, 
                ética profissional, técnicas terapêuticas, manejo de casos, e questões sobre 
                saúde mental em geral.

                Regras importantes:
                1. Nunca forneça diagnósticos específicos para pacientes
                2. Nunca substitua o julgamento clínico de um profissional
                3. Mantenha sigilo absoluto sobre qualquer informação compartilhada
                4. Consulte sempre o código de ética profissional
                5. Sugira buscar supervisão quando necessário
                6. Em casos de emergência, oriente contatar serviços especializados

                Seu tom deve ser profissional, empático e acolhedor.`,
                
                'general': 'Você é um assistente útil e amigável.'
            };

            const response = await axios.post(
                this.apiUrl,
                {
                    model: "gpt-3.5-turbo",
                    messages: [
                        {
                            role: "system",
                            content: systemPrompts[context] || systemPrompts['general']
                        },
                        {
                            role: "user",
                            content: message
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('Erro na API do ChatGPT:', error.response?.data || error.message);
            
            // Fallback responses
            const fallbackResponses = [
                "Desculpe, estou tendo dificuldades técnicas no momento. Por favor, tente novamente mais tarde.",
                "No momento não consigo processar sua solicitação. Você poderia reformular sua pergunta?",
                "Estou passando por algumas instabilidades. Enquanto isso, você pode consultar recursos como o Conselho Federal de Psicologia para informações atualizadas."
            ];
            
            return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
        }
    }
}

module.exports = new ChatGPTService();
