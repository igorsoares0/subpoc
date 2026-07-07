import { Paddle, Environment } from "@paddle/paddle-node-sdk"

// Client server-side do Paddle (API key secreta — nunca importar em client
// components). Lazy pra não estourar no build quando a env não está setada.

let client: Paddle | null = null

export function getPaddle(): Paddle {
  if (!client) {
    const apiKey = process.env.PADDLE_API_KEY
    if (!apiKey) {
      throw new Error("PADDLE_API_KEY is not set")
    }
    client = new Paddle(apiKey, {
      environment:
        process.env.PADDLE_ENV === "production"
          ? Environment.production
          : Environment.sandbox,
    })
  }
  return client
}
