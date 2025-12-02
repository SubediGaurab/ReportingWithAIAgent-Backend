exports.handler = async (event) => {
    const origin = event.headers?.origin || event.headers?.Origin;
    const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://gaurabsubedi.com'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    const corsHeaders = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    // For REST API Gateway, the method is in event.httpMethod
    // For HTTP API Gateway, it would be in event.requestContext.http.method
    const httpMethod = event.httpMethod || event.requestContext?.http?.method;

    if (httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: event.body
        });

        return {
            statusCode: response.status,
            headers: corsHeaders,
            body: await response.text()
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};