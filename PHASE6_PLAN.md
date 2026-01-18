# Lumenvil Faz 6: Platform Upload (Steam)

## Özet

Build tamamlandıktan sonra Steam'e (ve gelecekte diğer platformlara) otomatik upload sistemi.

---

## Mimari

```
Services/
  Platforms/
    IPlatformUploader.cs      → Ortak interface
    PlatformUploaderFactory.cs → Platform seçici
    Steam/
      SteamUploader.cs        → SteamCMD implementasyonu
      SteamVdfGenerator.cs    → VDF dosya oluşturucu

Models/
  PlatformConfig.cs           → Platform ayarları (DB'de JSON)
  UploadResult.cs             → Upload sonucu
```

---

## Yapılacaklar

### Backend

#### 1. Models
- [ ] `PlatformType` enum (Steam, Epic, ...)
- [ ] `PlatformConfig` model (JSON olarak Setting tablosunda)
- [ ] `UploadResult` record

#### 2. Interface & Factory
- [ ] `IPlatformUploader` interface
- [ ] `PlatformUploaderFactory` - platform'a göre uploader döner

#### 3. Steam Implementasyonu
- [ ] `SteamUploader` - SteamCMD wrapper
- [ ] `SteamVdfGenerator` - app_build.vdf oluşturma
- [ ] SteamCMD kurulum kontrolü

#### 4. Settings API
- [ ] `GET /api/settings/steam` - Steam ayarlarını getir
- [ ] `PUT /api/settings/steam` - Steam ayarlarını kaydet
- [ ] Şifre encryption (AES veya environment variable)

#### 5. Build Entegrasyonu
- [ ] Build tamamlandığında upload tetikleme
- [ ] Upload durumu takibi (SteamUploadStatus)

### Dashboard

#### 6. Settings Sayfası
- [ ] `/dashboard/settings` route
- [ ] Steam configuration form
- [ ] Connection test butonu

#### 7. Build'de Steam Seçenekleri
- [ ] Upload to Steam checkbox
- [ ] Steam branch seçimi
- [ ] Upload durumu gösterimi

---

## Steam VDF Örneği

```vdf
"AppBuild"
{
    "AppID" "480"
    "Desc" "Build #123"
    "ContentRoot" "D:\Builds\MyGame\Build_123"
    "BuildOutput" "D:\Builds\MyGame\Build_123\output"
    "Depots"
    {
        "481"
        {
            "FileMapping"
            {
                "LocalPath" "*"
                "DepotPath" "."
                "recursive" "1"
            }
        }
    }
}
```

---

## API Endpoints

```
GET    /api/settings/steam          - Steam ayarlarını getir (Admin)
PUT    /api/settings/steam          - Steam ayarlarını kaydet (Admin)
POST   /api/settings/steam/test     - Bağlantı testi (Admin)
POST   /api/build/{id}/upload       - Manuel upload tetikle (Admin/Dev)
```

---

## Kurallar

- Git push ASLA otomatik yapılmaz
- Steam credentials güvenli saklanmalı (.env veya encrypted DB)
- SteamGuard 2FA için özel handling gerekebilir
