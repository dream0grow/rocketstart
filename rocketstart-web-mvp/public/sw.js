self.addEventListener('install', function () {
  self.skipWaiting()
})

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', function (event) {
  var payload = event.data ? event.data.json() : { title: 'RocketStart', body: '지금 로켓을 시작할 시간입니다.' }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: payload.data || {},
      actions: [
        { action: 'start', title: '시작' },
        { action: 'shrink', title: '15분으로 축소' },
        { action: 'reflect', title: '이유 기록' }
      ]
    })
  )
})
