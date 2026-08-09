export type Rol = 'yonetici' | 'avukat' | 'stajyer';
export type OnayDurumu = 'bekliyor' | 'onayli' | 'reddedildi';

export const ROL_ETIKET: Record<Rol, string> = {
  yonetici: 'Yönetici',
  avukat: 'Avukat',
  stajyer: 'Stajyer',
};

export const ONAY_ETIKET: Record<OnayDurumu, string> = {
  bekliyor: 'Onay bekliyor',
  onayli: 'Onaylı',
  reddedildi: 'Reddedildi',
};

export type Profil = {
  id: string;
  eposta: string;
  ad_soyad: string | null;
  rol: Rol;
  aktif: boolean;
  onay_durumu: OnayDurumu;
  sifre_belirlendi?: boolean;
  created_at: string;
};

export type Dosya = {
  id: string;
  ad: string;
  storage_path: string;
  boyut: number | null;
  mime: string | null;
  klasor: string;
  yol: string | null;
  aciklama: string | null;
  gizli: boolean;
  /** null → AKC Hukuk Genel alanı; dolu → o kişinin alanı */
  alan_sahibi: string | null;
  sahip_id: string;
  created_at: string;
  guncelleme_at: string | null;
  guncelleyen_id: string | null;
};

export type DosyaSatiri = Dosya & {
  sahip_ad: string;
  alan_ad: string;
  izinliler: string[];
  duzenleyebilir: boolean;
};

export const GENEL_ALAN = 'AKC Hukuk — Genel';
