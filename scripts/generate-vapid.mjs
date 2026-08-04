/** Prints a fresh VAPID key pair plus a session secret, ready to paste into .env. */
import webpush from 'web-push'
import { randomBytes } from 'node:crypto'

const keys = webpush.generateVAPIDKeys()

console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log(`SESSION_SECRET=${randomBytes(32).toString('base64url')}`)
console.log(`CRON_SECRET=${randomBytes(24).toString('base64url')}`)
console.log()
console.log('Cambiar las VAPID keys invalida todas las suscripciones existentes.')
