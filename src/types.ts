export type JK = 'L' | 'P';

export type IzinTinggalType = 'VOA' | 'ITK' | 'ITAS' | 'ITAP';

export interface BaseWNA {
  id: string;
  namaLengkap: string;
  jk: JK;
  negara: string;
  noPaspor: string;
  berlakuHingga: string;
  sponsor: string;
  alamat: string;
  domisili: string;
  type: IzinTinggalType;
  latitude?: number;
  longitude?: number;
}

export interface WNA_VoA extends BaseWNA {
  type: 'VOA';
}

export interface WNA_ITK extends BaseWNA {
  type: 'ITK';
}

export interface WNA_ITAS extends BaseWNA {
  type: 'ITAS';
  dokim: string;
  pekerjaan: string;
}

export interface WNA_ITAP extends BaseWNA {
  type: 'ITAP';
  dokim: string;
  tempatTanggalLahir: string;
}

export type WNA = WNA_VoA | WNA_ITK | WNA_ITAS | WNA_ITAP;
