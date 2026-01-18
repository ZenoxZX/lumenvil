# Phase 7: Webhook & Notifications

## Özet
Build olayları için bildirim sistemi. Discord, Slack webhook'ları ve email desteği.

## Özellikler

### 1. Notification Channels
- **Discord** - Webhook URL ile zengin embed mesajlar
- **Slack** - Webhook URL ile formatted mesajlar
- **Email** - SMTP ile email bildirimleri
- **Generic Webhook** - Custom endpoint'lere POST

### 2. Trigger Events
- `build.started` - Build başladığında
- `build.completed` - Build başarıyla tamamlandığında
- `build.failed` - Build başarısız olduğunda
- `build.cancelled` - Build iptal edildiğinde
- `upload.completed` - Steam upload tamamlandığında
- `upload.failed` - Steam upload başarısız olduğunda

### 3. Yapılandırma Seviyeleri
- **Global** - Tüm projeler için varsayılan
- **Per-Project** - Proje bazlı override (opsiyonel, Phase 7.5)

---

## Backend Mimarisi

### Models

```
src/Backend/Models/
├── NotificationModels.cs
│   ├── NotificationChannel (enum: Discord, Slack, Email, Webhook)
│   ├── NotificationEvent (enum: BuildStarted, BuildCompleted, etc.)
│   ├── NotificationConfig
│   └── NotificationLog
```

### Services

```
src/Backend/Services/Notifications/
├── INotificationSender.cs      # Interface
├── NotificationService.cs      # Orchestrator
├── DiscordNotifier.cs          # Discord webhook
├── SlackNotifier.cs            # Slack webhook
├── EmailNotifier.cs            # SMTP email
└── WebhookNotifier.cs          # Generic webhook
```

### API Endpoints

```
GET    /api/notifications/config          # Tüm config'leri getir
PUT    /api/notifications/config          # Config güncelle
POST   /api/notifications/test            # Test bildirimi gönder
GET    /api/notifications/logs            # Bildirim logları
```

---

## Dashboard UI

### Settings Page Eklentisi

```
/dashboard/settings
├── Steam Configuration (mevcut)
├── Notifications
│   ├── Discord
│   │   ├── Webhook URL
│   │   ├── Enabled events (checkboxes)
│   │   └── Test button
│   ├── Slack
│   │   ├── Webhook URL
│   │   ├── Enabled events
│   │   └── Test button
│   ├── Email
│   │   ├── SMTP settings
│   │   ├── Recipients
│   │   └── Test button
│   └── Generic Webhook
│       ├── URL
│       ├── Secret (for HMAC)
│       ├── Enabled events
│       └── Test button
```

---

## Mesaj Formatları

### Discord Embed
```json
{
  "embeds": [{
    "title": "Build #42 Completed",
    "description": "Project: MyGame\nBranch: main\nDuration: 5m 32s",
    "color": 3066993,
    "fields": [
      {"name": "Status", "value": "Success", "inline": true},
      {"name": "Size", "value": "1.2 GB", "inline": true}
    ],
    "timestamp": "2024-01-18T12:00:00Z"
  }]
}
```

### Slack Block
```json
{
  "blocks": [
    {
      "type": "header",
      "text": {"type": "plain_text", "text": "Build #42 Completed"}
    },
    {
      "type": "section",
      "fields": [
        {"type": "mrkdwn", "text": "*Project:* MyGame"},
        {"type": "mrkdwn", "text": "*Branch:* main"},
        {"type": "mrkdwn", "text": "*Status:* Success"},
        {"type": "mrkdwn", "text": "*Duration:* 5m 32s"}
      ]
    }
  ]
}
```

### Generic Webhook Payload
```json
{
  "event": "build.completed",
  "timestamp": "2024-01-18T12:00:00Z",
  "build": {
    "id": "...",
    "number": 42,
    "project": "MyGame",
    "branch": "main",
    "status": "Success",
    "duration": 332,
    "size": 1288490188
  }
}
```

---

## Implementation Sırası

1. **Models & Database**
   - NotificationConfig model
   - NotificationLog model (opsiyonel)
   - Database migration

2. **Notification Services**
   - INotificationSender interface
   - NotificationService (orchestrator)
   - DiscordNotifier
   - SlackNotifier

3. **API Endpoints**
   - SettingsController'a notification endpoints ekle
   - Test endpoint

4. **BuildQueueService Integration**
   - Build status değişikliklerinde notification trigger

5. **Dashboard UI**
   - Settings sayfasına notification section ekle
   - Test buttons

6. **Email Support** (opsiyonel)
   - SMTP configuration
   - EmailNotifier

---

## Konfigürasyon Örneği (Database'de JSON)

```json
{
  "discord": {
    "enabled": true,
    "webhookUrl": "https://discord.com/api/webhooks/...",
    "events": ["build.completed", "build.failed"]
  },
  "slack": {
    "enabled": false,
    "webhookUrl": null,
    "events": []
  },
  "email": {
    "enabled": false,
    "smtp": {
      "host": "smtp.gmail.com",
      "port": 587,
      "username": "",
      "password": ""
    },
    "recipients": []
  },
  "webhook": {
    "enabled": false,
    "url": null,
    "secret": null,
    "events": []
  }
}
```

---

## Test Senaryoları

- TC-7.1: Discord webhook URL kaydetme
- TC-7.2: Discord test bildirimi gönderme
- TC-7.3: Slack webhook URL kaydetme
- TC-7.4: Slack test bildirimi gönderme
- TC-7.5: Build tamamlandığında otomatik bildirim
- TC-7.6: Build başarısız olduğunda otomatik bildirim
- TC-7.7: Generic webhook ile custom endpoint'e POST
- TC-7.8: Email bildirim gönderme (SMTP configured)
