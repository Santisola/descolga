function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Falta la variable de entorno ${name}. Ver .env.example.`)
  return value
}

export const env = {
  get sessionSecret() {
    return required('SESSION_SECRET')
  },
  get vapidPublicKey() {
    return required('NEXT_PUBLIC_VAPID_PUBLIC_KEY')
  },
  get vapidPrivateKey() {
    return required('VAPID_PRIVATE_KEY')
  },
  get vapidSubject() {
    return process.env.VAPID_SUBJECT || 'mailto:hola@descolga.app'
  },
  get cronSecret() {
    return required('CRON_SECRET')
  },
  get appUrl() {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  },
}
