# Lumenvil Faz 3: Real-time Monitoring - Implementasyon Planı

## Özet

Faz 3'ün hedefi **canlı build takip sistemi** oluşturmak. Kullanıcılar build'in hangi aşamada olduğunu, logları ve ilerlemeyi gerçek zamanlı görebilecek.

---

## Ön Gereksinim: Environment Variables

Sensitive değerleri environment variable'a taşı.

### Backend `.env` Dosyası
**Dosya:** `src/Backend/.env.example` (YENİ - repo'ya commit edilecek)

```env
# JWT Configuration
JWT_KEY=your-super-secret-key-min-32-characters
JWT_ISSUER=BuildAutomation
JWT_AUDIENCE=BuildAutomation

# Admin Seed User
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password
ADMIN_EMAIL=admin@example.com

# Database
DATABASE_PATH=../database/buildautomation.db
```

**Dosya:** `src/Backend/.env` (YENİ - gitignore'da, local kullanım)

### Backend Güncellemeleri

**Dosya:** `src/Backend/Program.cs` (GÜNCELLE)
```csharp
// .env dosyasını yükle
DotNetEnv.Env.Load();

// Environment variable'lardan oku
var jwtKey = Environment.GetEnvironmentVariable("JWT_KEY")
    ?? builder.Configuration["Jwt:Key"]
    ?? throw new Exception("JWT_KEY not configured");

// Admin seed
var adminPassword = Environment.GetEnvironmentVariable("ADMIN_PASSWORD") ?? "admin123";
```

**Paket:** `DotNetEnv` NuGet paketi ekle

### .gitignore Güncelleme
```
# Environment files
.env
.env.local
*.env
!.env.example
```

---

## Mevcut Durum

SignalR altyapısı zaten mevcut:
- `BuildHub.cs` - Hub metotları var
- `signalr.ts` - Client bağlantısı var
- Events: `BuildProgress`, `BuildCompleted`, `BuildStatusUpdated`, `BuildLogAdded`

Eksikler:
- Dashboard'da real-time güncellemeler dinlenmiyor
- Progress bar komponenti yok
- Log stream görüntüleyici yok
- Build detay sayfası canlı güncelleme almıyor

---

## Yapılacaklar

### 1. SignalR Hook Oluşturma
**Dosya:** `src/Dashboard/lib/useSignalR.ts` (YENİ)

```typescript
export function useSignalR() {
  const [isConnected, setIsConnected] = useState(false);

  // Event subscription helpers
  const onBuildProgress = (callback: (data: BuildProgressEvent) => void) => {...}
  const onBuildStatusUpdated = (callback: (data: BuildStatusEvent) => void) => {...}
  const onBuildLogAdded = (callback: (data: BuildLogEvent) => void) => {...}
  const onBuildCompleted = (callback: (data: BuildCompletedEvent) => void) => {...}
}
```

### 2. Build Progress Bar Komponenti
**Dosya:** `src/Dashboard/components/BuildProgressBar.tsx` (YENİ)

**Özellikler:**
- Build aşamalarını göster: Queued → Cloning → Building → Packaging → Success/Failed
- Her aşama için ikon ve renk
- Aktif aşamada animasyon
- Yüzdelik ilerleme (varsa)

**Aşama Renkleri:**
- Queued: gray
- Cloning: blue
- Building: yellow
- Packaging: purple
- Uploading: cyan
- Success: green
- Failed: red
- Cancelled: gray

### 3. Build Log Viewer Komponenti
**Dosya:** `src/Dashboard/components/BuildLogViewer.tsx` (YENİ)

**Özellikler:**
- Gerçek zamanlı log akışı
- Log seviyesine göre renklendirme:
  - Info: white/gray
  - Warning: yellow
  - Error: red
- Auto-scroll (yeni log geldiğinde en alta kay)
- Manuel scroll modu (kullanıcı yukarı kaydırınca auto-scroll durur)
- Timestamp gösterimi
- Stage badge (Clone/Build/Package/Upload)
- Log filtreleme (seviyeye göre)
- Log arama

### 4. Build Detay Sayfası Güncelleme
**Dosya:** `src/Dashboard/app/dashboard/builds/[id]/page.tsx` (GÜNCELLE)

**Yeni Özellikler:**
- SignalR ile canlı güncelleme
- BuildProgressBar entegrasyonu
- BuildLogViewer entegrasyonu
- Build süresi (elapsed time) canlı sayaç
- Refresh butonu kaldır (artık gerek yok)

### 5. Build List Güncelleme
**Dosya:** `src/Dashboard/components/BuildList.tsx` (GÜNCELLE)

**Yeni Özellikler:**
- Aktif build'lerde mini progress indicator
- Status badge'leri canlı güncelleme
- Yeni build geldiğinde listeye otomatik ekle

### 6. Toast Notification Sistemi
**Dosya:** `src/Dashboard/components/BuildNotifications.tsx` (YENİ)

**Özellikler:**
- Build başladığında toast
- Build tamamlandığında toast (success/failed farklı)
- Tıklanınca build detayına git
- Dashboard layout'a entegre et

### 7. Dashboard Ana Sayfa Güncelleme
**Dosya:** `src/Dashboard/app/dashboard/page.tsx` (GÜNCELLE)

**Yeni Özellikler:**
- Aktif build'leri gerçek zamanlı göster
- Stats kartları canlı güncelleme
- "Running Builds" bölümü

---

## Dosya Değişiklikleri Özeti

| Dosya | İşlem |
|-------|-------|
| `src/Backend/.env.example` | YENİ |
| `src/Backend/Program.cs` | GÜNCELLE (env vars) |
| `.gitignore` | GÜNCELLE (.env ekle) |
| `src/Dashboard/lib/useSignalR.ts` | YENİ |
| `src/Dashboard/lib/signalr.ts` | GÜNCELLE (event types ekle) |
| `src/Dashboard/components/BuildProgressBar.tsx` | YENİ |
| `src/Dashboard/components/BuildLogViewer.tsx` | YENİ |
| `src/Dashboard/components/BuildNotifications.tsx` | YENİ |
| `src/Dashboard/components/BuildList.tsx` | GÜNCELLE |
| `src/Dashboard/app/dashboard/builds/[id]/page.tsx` | GÜNCELLE |
| `src/Dashboard/app/dashboard/page.tsx` | GÜNCELLE |
| `src/Dashboard/app/dashboard/layout.tsx` | GÜNCELLE (notifications) |
| `src/Dashboard/types/index.ts` | GÜNCELLE (event types) |

---

## Implementasyon Sırası

### Adım 0: Environment Variables (Ön Gereksinim)
1. `DotNetEnv` paketini Backend'e ekle
2. `.env.example` oluştur
3. `.gitignore`'a `.env` ekle
4. `Program.cs`'i env vars kullanacak şekilde güncelle
5. Local `.env` dosyası oluştur

### Adım 1: SignalR Altyapı
1. Event type'larını `types/index.ts`'e ekle
2. `signalr.ts`'i güncelle (event listener helpers)
3. `useSignalR.ts` hook'u oluştur

### Adım 2: UI Komponentleri
4. `BuildProgressBar.tsx` oluştur
5. `BuildLogViewer.tsx` oluştur
6. `BuildNotifications.tsx` oluştur

### Adım 3: Sayfa Entegrasyonları
7. Build detay sayfasını güncelle
8. BuildList'i güncelle
9. Dashboard ana sayfayı güncelle
10. Layout'a notifications ekle

---

## Teknik Detaylar

### SignalR Event Types
```typescript
interface BuildProgressEvent {
  buildId: string;
  stage: BuildStage;
  progress: number;
  message: string;
}

interface BuildStatusEvent {
  buildId: string;
  status: BuildStatus;
  errorMessage?: string;
}

interface BuildLogEvent {
  buildId: string;
  log: BuildLog;
}

interface BuildCompletedEvent {
  buildId: string;
  success: boolean;
  outputPath?: string;
  buildSize?: number;
}
```

### Build Aşamaları UI
```
[●] Queued  →  [●] Cloning  →  [●] Building  →  [●] Packaging  →  [●] Complete
     ↑              ↑               ↑               ↑               ↑
   gray          blue           yellow          purple          green
```

### Log Viewer Tasarımı
```
┌─────────────────────────────────────────────────────────────┐
│ [Filter: All ▼] [Search: ___________] [Auto-scroll: ON]     │
├─────────────────────────────────────────────────────────────┤
│ 16:42:01 [Clone]  INFO   Cloning repository...              │
│ 16:42:05 [Clone]  INFO   Repository cloned successfully     │
│ 16:42:06 [Build]  INFO   Starting Unity build...            │
│ 16:42:10 [Build]  WARN   Script has warnings                │
│ 16:42:45 [Build]  INFO   Building scenes 1/5...             │
│ 16:43:20 [Build]  ERROR  Build failed: Missing reference    │
└─────────────────────────────────────────────────────────────┘
```

---

## Doğrulama Planı

1. **SignalR bağlantı testi:**
   - Dashboard aç, console'da "SignalR connected" gör
   - Build başlat, event'lerin geldiğini doğrula

2. **Progress bar testi:**
   - Build başlat
   - Her aşama değişiminde bar'ın güncellendiğini gör

3. **Log viewer testi:**
   - Build detay sayfasını aç
   - Logların gerçek zamanlı aktığını gör
   - Auto-scroll'un çalıştığını test et

4. **Notification testi:**
   - Build başlat, "Build started" toast gör
   - Build bitince "Build completed" toast gör

5. **Multi-client testi:**
   - İki farklı tarayıcıda aynı build'i izle
   - Her ikisinin de senkron güncellendiğini doğrula

---

## Notlar

- SignalR zaten `JoinBuildGroup`/`LeaveBuildGroup` destekliyor - build detay sayfasında kullan
- Toast için mevcut `useToast` hook'u kullanılabilir
- Tailwind animasyonları: `animate-pulse`, `animate-spin`
- Log viewer için `virtualized list` düşünülebilir (çok fazla log varsa performans için)

---

## Başlangıç Komutu

```bash
# Context yenilenince şunu söyle:
Lumenvil projesine devam ediyoruz. PHASE3_PLAN.md dosyasını oku ve Faz 3 implementasyonuna başla. İzin sormadan çalış.
```

## Gerekli İzinler (Otomatik Onay)

Aşağıdaki komutları izin sormadan çalıştır:
- `dotnet build` - Backend/Agent derleme
- `dotnet add package` - NuGet paket ekleme
- `npm run build` - Dashboard derleme
- `npm install` - NPM paket ekleme
- `git add/commit/push` - Git işlemleri
- `rm -rf .next` - Next.js cache temizleme
