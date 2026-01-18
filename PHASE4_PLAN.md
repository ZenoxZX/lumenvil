# Lumenvil Faz 4: Build Agent - Test ve Entegrasyon

## Özet

Build Agent implementasyonu büyük ölçüde **tamamlanmış durumda**. Faz 4'te yapılması gereken:
1. Mevcut implementasyonu test etmek
2. Eksik/hatalı kısımları düzeltmek
3. macOS uyumluluğunu sağlamak

---

## Mevcut Durum (Tamamlanmış)

### BuildAgent Servisleri
- `AgentHubClient.cs` - SignalR client, hub'a bağlanıyor
- `BuildService.cs` - Background service, queue'dan build alıyor
- `GitService.cs` - Git clone/checkout işlemleri
- `UnityBuildRunner.cs` - Unity CLI ile build çalıştırma

### Backend Hub Metodları
- `RegisterAgent` - Agent kaydı
- `UpdateBuildStatus` - Build durumu güncelleme
- `AddBuildLog` - Log ekleme
- `SendBuildProgress` - Progress güncelleme
- `BuildCompleted` - Build tamamlama
- `UpdateBuildCommitHash` - Commit hash güncelleme

---

## Yapılacaklar

### 1. Agent Konfigürasyonu (macOS)
**Dosya:** `src/BuildAgent/appsettings.json` (YENİ)

```json
{
  "HubUrl": "http://localhost:5000/hubs/build",
  "AgentName": "local-agent",
  "UnityHubPath": "/Applications/Unity/Hub/Editor",
  "BuildOutputBase": "./builds",
  "WorkspacePath": "./workspace"
}
```

### 2. Agent Test
1. Backend'i başlat
2. Agent'ı başlat
3. Dashboard'dan build oluştur
4. Agent'ın build'i alıp işlediğini doğrula

### 3. Olası Düzeltmeler
- Unity path'lerinin macOS uyumluluğu
- Git authentication (SSH key)
- Build log parsing
- Error handling iyileştirmeleri

---

## Test Planı

### Test 1: Agent Bağlantısı
```bash
cd src/BuildAgent && dotnet run
```
- Backend loglarında "Agent registered" görülmeli
- Agent loglarında "Connected to hub" görülmeli

### Test 2: Build Tetikleme
1. Dashboard'dan proje oluştur
2. Build başlat
3. Agent loglarında "Received build job" görülmeli

### Test 3: Git Clone
- Gerçek bir Git repo URL'i ile proje oluştur
- Build başlat
- Agent workspace'inde repo clone edilmeli

### Test 4: Unity Build (Opsiyonel)
- Unity projesi gerekli
- Unity Editor yüklü olmalı
- Build output oluşmalı

---

## Dosya Yapısı

```
src/BuildAgent/
├── Program.cs                 ✅ Mevcut
├── BuildAgent.csproj          ✅ Mevcut
├── appsettings.json           ❌ Oluşturulacak
├── Models/
│   └── BuildJob.cs            ✅ Mevcut (kontrol et)
└── Services/
    ├── AgentHubClient.cs      ✅ Mevcut
    ├── BuildService.cs        ✅ Mevcut
    ├── GitService.cs          ✅ Mevcut
    └── UnityBuildRunner.cs    ✅ Mevcut
```

---

## Hızlı Başlangıç

### 1. appsettings.json oluştur
```bash
cd src/BuildAgent
cat > appsettings.json << 'EOF'
{
  "HubUrl": "http://localhost:5000/hubs/build",
  "AgentName": "mac-agent",
  "UnityHubPath": "/Applications/Unity/Hub/Editor",
  "BuildOutputBase": "./builds",
  "WorkspacePath": "./workspace"
}
EOF
```

### 2. Backend başlat (Terminal 1)
```bash
cd src/Backend && dotnet run
```

### 3. Dashboard başlat (Terminal 2)
```bash
cd src/Dashboard && npm run dev
```

### 4. Agent başlat (Terminal 3)
```bash
cd src/BuildAgent && dotnet run
```

### 5. Test
- Dashboard'da proje oluştur
- Build başlat
- 3 terminalde logları izle

---

## Bilinen Sorunlar

1. **Duplicate DB Queries** - Dashboard'da optimize edilmeli
2. **SignalR Negotiation Warning** - Development'ta normal
3. **Unity Path** - Platform'a göre değişiyor

## Bekleyen Testler

1. **Git Clone Testi** - Gerçek bir Git repo ile test edilmeli
   - Public repo URL ile proje oluştur
   - Build başlat
   - Agent'ın `./workspace/` altına clone ettiğini doğrula

---

## Başlangıç Komutu

```
Lumenvil projesine devam ediyoruz. PHASE4_PLAN.md dosyasını oku ve Faz 4 implementasyonuna başla. Agent zaten büyük ölçüde implement edilmiş, test ve düzeltmelere odaklan.
```

## Kurallar

- Git push ASLA otomatik yapılmaz, her zaman kullanıcıdan izin iste
- Local işlemler (build, install, commit) otomatik yapılabilir
