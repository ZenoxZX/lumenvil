# Test Cases - Lumenvil Build Automation

Bu dosya QA süreçlerinde kullanılmak üzere tüm test senaryolarını içerir.

---

## Phase 6: Steam Integration

### Ön Koşullar
- Backend çalışıyor (`cd src/Backend && dotnet run`)
- Dashboard çalışıyor (`cd src/Dashboard && npm run dev`)
- Admin kullanıcı ile giriş yapılmış (`admin` / `admin123`)

---

### TC-6.1: Settings Sayfası Erişimi

**Açıklama:** Admin kullanıcılar Settings sayfasına erişebilmeli

**Adımlar:**
1. Admin olarak giriş yap
2. Sol menüden "Settings" linkine tıkla
3. `/dashboard/settings` sayfasına yönlendirildiğini doğrula

**Beklenen Sonuç:**
- Settings sayfası yüklenmeli
- "Steam Configuration" kartı görünmeli
- "Platforms" kartında Steam "Available" olarak görünmeli

**Not:** Non-admin kullanıcılar bu sayfayı görmemeli (menüde link yok + sayfa "Admin access required" mesajı göstermeli)

---

### TC-6.2: Steam Ayarlarını Kaydetme

**Açıklama:** Steam credentials ve ayarları kaydedilebilmeli

**Adımlar:**
1. Settings sayfasına git
2. Steam Username alanına bir değer gir (örn: `test_user`)
3. Steam Password alanına bir değer gir
4. Default Steam Branch alanına bir değer gir (örn: `beta`)
5. "Save Settings" butonuna tıkla

**Beklenen Sonuç:**
- "Settings Saved" toast mesajı görünmeli
- Badge "Configured" olarak değişmeli
- Sayfa yenilendiğinde username ve branch değerleri korunmalı
- Password alanı boş görünmeli (güvenlik için)

---

### TC-6.3: Steam Bağlantı Testi

**Açıklama:** Steam bağlantısı test edilebilmeli

**Ön Koşul:** Steam ayarları kaydedilmiş olmalı

**Adımlar:**
1. Settings sayfasına git
2. "Test Connection" butonuna tıkla

**Beklenen Sonuç:**
- SteamCMD kurulu değilse: "Connection Failed" toast mesajı
- SteamCMD kurulu ve credentials doğruysa: "Connection Successful" toast mesajı

---

### TC-6.4: NewBuildForm - Steam Upload Checkbox (Disabled)

**Açıklama:** Steam ayarları yapılmamış veya proje Steam bilgileri eksikse checkbox disabled olmalı

**Ön Koşul:**
- Steam ayarları yapılandırılmış
- Proje'de `steamAppId` veya `steamDepotId` eksik

**Adımlar:**
1. Dashboard ana sayfasına git
2. "Start New Build" formunu bul
3. Steam upload checkbox'ını kontrol et

**Beklenen Sonuç:**
- "Upload to Steam after build" checkbox'ı disabled olmalı
- Altında "Project needs Steam AppId and DepotId configured to enable upload" mesajı görünmeli

---

### TC-6.5: NewBuildForm - Steam Upload Checkbox (Enabled)

**Açıklama:** Tüm koşullar sağlandığında Steam upload seçilebilmeli

**Ön Koşul:**
- Steam ayarları yapılandırılmış (username + password)
- Proje'de `steamAppId` ve `steamDepotId` tanımlı

**Adımlar:**
1. Dashboard ana sayfasına git
2. "Start New Build" formunu bul
3. Steam upload checkbox'ını işaretle

**Beklenen Sonuç:**
- Checkbox işaretlenebilmeli
- "Steam Branch" input alanı görünmeli
- Default değer settings'ten gelmeli (örn: `default` veya `beta`)

---

### TC-6.6: Build Detail - Steam Upload Kartı

**Açıklama:** Steam upload bilgileri build detay sayfasında görünmeli

**Ön Koşul:** `uploadToSteam: true` ile bir build oluşturulmuş olmalı

**Adımlar:**
1. Build listesinden ilgili build'e tıkla
2. Build detay sayfasına git

**Beklenen Sonuç:**
- "Steam Upload" kartı görünmeli
- Upload Status gösterilmeli (Pending, Uploading, Success, Failed)
- Steam Branch gösterilmeli
- Upload başarılıysa Steam Build ID gösterilmeli

---

### TC-6.7: Manuel Upload Trigger

**Açıklama:** Başarılı build'ler için manuel Steam upload tetiklenebilmeli

**Ön Koşul:**
- Build status: Success
- Steam ayarları yapılandırılmış
- Proje'de Steam AppId ve DepotId tanımlı

**Adımlar:**
1. Başarılı bir build'in detay sayfasına git
2. "Upload to Steam" butonuna tıkla

**Beklenen Sonuç:**
- SteamCMD kurulu değilse: Hata mesajı
- SteamCMD kuruluysa: Upload başlamalı, status "Uploading" olmalı

---

### TC-6.8: API - Steam Settings Endpoints

**Açıklama:** Steam settings API'ları doğru çalışmalı

**Test Komutları:**
```bash
# Login ve token al
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

# Steam ayarlarını al (GET)
curl -s http://localhost:5000/api/settings/steam \
  -H "Authorization: Bearer $TOKEN" | jq

# Beklenen response:
# {
#   "username": "...",
#   "hasPassword": true/false,
#   "steamCmdPath": "...",
#   "defaultBranch": "...",
#   "isConfigured": true/false
# }

# Steam ayarlarını güncelle (PUT)
curl -s -X PUT http://localhost:5000/api/settings/steam \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123","defaultBranch":"beta"}' | jq

# Platformları listele (GET)
curl -s http://localhost:5000/api/settings/platforms \
  -H "Authorization: Bearer $TOKEN" | jq

# Beklenen response:
# [
#   { "type": "Steam", "name": "Steam", "isImplemented": true },
#   { "type": "Epic", "name": "Epic Games Store", "isImplemented": false }
# ]
```

---

### TC-6.9: API - Build Upload Endpoint

**Açıklama:** Build upload API'sı doğru çalışmalı

**Test Komutları:**
```bash
# Manuel upload tetikle (POST)
curl -s -X POST http://localhost:5000/api/build/{BUILD_ID}/upload \
  -H "Authorization: Bearer $TOKEN" | jq

# Başarısız durumlar:
# - Build not found: 404
# - Build not successful: 400 "Only successful builds can be uploaded"
# - No output path: 400 "Build has no output path"
# - Steam not configured: 400 "Steam is not configured"
# - Project missing Steam IDs: 400 "Project does not have Steam AppId and DepotId configured"
```

---

## Phase 5: User Management

### TC-5.1: Users Sayfası Erişimi

**Açıklama:** Admin kullanıcılar Users sayfasına erişebilmeli

**Adımlar:**
1. Admin olarak giriş yap
2. Sol menüden "Users" linkine tıkla

**Beklenen Sonuç:**
- Users listesi görünmeli
- "Add User" butonu görünmeli

---

### TC-5.2: Yeni Kullanıcı Oluşturma

**Adımlar:**
1. Users sayfasına git
2. "Add User" butonuna tıkla
3. Username, Email, Password ve Role gir
4. "Create User" butonuna tıkla

**Beklenen Sonuç:**
- Kullanıcı listede görünmeli
- Yeni kullanıcı ile giriş yapılabilmeli

---

### TC-5.3: Kullanıcı Rolü Değiştirme

**Adımlar:**
1. Users sayfasına git
2. Bir kullanıcının rol dropdown'ını değiştir

**Beklenen Sonuç:**
- Rol güncellenmiş olmalı
- Kullanıcı yeni yetkilerle çalışmalı

---

## Phase 4: Build Agent

### TC-4.1: Build Oluşturma

**Adımlar:**
1. Bir proje oluştur veya mevcut projeyi seç
2. "Start Build" butonuna tıkla
3. Branch ve scripting backend seç
4. Build'i başlat

**Beklenen Sonuç:**
- Build "Queued" durumunda başlamalı
- Real-time log akışı görünmeli
- Progress bar ilerlemeli

---

### TC-4.2: Build İptali

**Adımlar:**
1. Çalışan bir build'in detay sayfasına git
2. "Cancel Build" butonuna tıkla

**Beklenen Sonuç:**
- Build "Cancelled" durumuna geçmeli
- İptal mesajı görünmeli

---

## Phase 3: Real-time Monitoring

### TC-3.1: SignalR Bağlantısı

**Adımlar:**
1. Dashboard'a giriş yap
2. Browser console'da "SignalR connected" mesajını kontrol et

**Beklenen Sonuç:**
- SignalR bağlantısı kurulmalı
- Build güncellemeleri real-time gelmeli

---

### TC-3.2: Build Notifications

**Adımlar:**
1. Dashboard açıkken başka bir sekmeden build başlat
2. İlk sekmeye dön

**Beklenen Sonuç:**
- Toast notification görünmeli
- Build durumu otomatik güncellenmiş olmalı

---

## Genel Test Notları

### Rol Yetkileri

| Özellik | Viewer | Developer | Admin |
|---------|--------|-----------|-------|
| Dashboard görüntüleme | ✅ | ✅ | ✅ |
| Build listesi görüntüleme | ✅ | ✅ | ✅ |
| Proje listesi görüntüleme | ✅ | ✅ | ✅ |
| Build oluşturma | ❌ | ✅ | ✅ |
| Build iptal etme | ❌ | ✅ | ✅ |
| Proje oluşturma/düzenleme | ❌ | ❌ | ✅ |
| Kullanıcı yönetimi | ❌ | ❌ | ✅ |
| Settings sayfası | ❌ | ❌ | ✅ |

### Test Ortamı Kurulumu

```bash
# Backend başlat
cd src/Backend && dotnet run

# Dashboard başlat (ayrı terminal)
cd src/Dashboard && npm run dev

# Database sıfırla (gerekirse)
rm database/buildautomation.db*
# Backend'i yeniden başlat

# Default admin credentials
Username: admin
Password: admin123
```

### Bilinen Limitasyonlar

1. **Steam Upload:** SteamCMD kurulu olmalı ve Steam Guard ayarlanmış olmalı
2. **Unity Build:** Unity Editor kurulu olmalı ve lisanslı olmalı
3. **Git Clone:** SSH key veya credentials ayarlanmış olmalı (private repo'lar için)
