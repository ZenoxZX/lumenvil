# Lumenvil Faz 5: Kullanıcı Yönetimi

## Özet

Admin kullanıcıların diğer kullanıcıları yönetebilmesi için gerekli özellikler.

---

## Özellikler

### 1. Kullanıcı Listesi
- Tüm kullanıcıları listele
- Rol, email, oluşturulma tarihi göster
- Sadece Admin görebilir

### 2. Kullanıcı Davet (Invite)
- Admin yeni kullanıcı oluşturabilir
- Username, email, şifre, rol seçimi
- Oluşturulan kullanıcıya bilgi göster

### 3. Rol Düzenleme
- Kullanıcı rolünü değiştir (Admin, Developer, Viewer)
- Admin kendini düşüremez (güvenlik)

### 4. Kullanıcı Silme
- Admin kullanıcı silebilir
- Admin kendini silemez
- Onay dialog'u

---

## API Endpoints

```
GET    /api/user           - Tüm kullanıcıları listele (Admin)
POST   /api/user           - Yeni kullanıcı oluştur (Admin)
PUT    /api/user/{id}/role - Rol güncelle (Admin)
DELETE /api/user/{id}      - Kullanıcı sil (Admin)
```

---

## Yapılacaklar

### Backend
- [ ] UserController oluştur
- [ ] DTO'lar (UserResponse, CreateUserRequest, UpdateRoleRequest)
- [ ] Yetkilendirme kontrolleri

### Dashboard
- [ ] /dashboard/users sayfası
- [ ] Kullanıcı listesi tablosu
- [ ] Yeni kullanıcı modal/form
- [ ] Rol değiştirme dropdown
- [ ] Silme butonu + onay dialog

---

## Kurallar

- Git push ASLA otomatik yapılmaz
- Local işlemler (build, install, commit) otomatik yapılabilir
