class WNAModel {
  constructor(data) {
    this.namaLengkap = data.namaLengkap || '';
    this.noPaspor = data.noPaspor || '';
    this.negara = data.negara || '';
    this.type = data.type || '';
    this.sponsor = data.sponsor || '';
    this.alamat = data.alamat || '';
    this.domisili = data.domisili || '';
    this.latitude = data.latitude || null;
    this.longitude = data.longitude || null;
    this.tanggalMasuk = data.tanggalMasuk || new Date().toISOString().split('T')[0];
    this.tanggalBerlaku = data.tanggalBerlaku || null;
    this.status = data.status || 'ACTIVE';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.createdBy = data.createdBy || 'system';
  }

  validate() {
    const required = ['namaLengkap', 'noPaspor', 'negara', 'type', 'sponsor', 'alamat', 'domisili'];
    const missing = required.filter(field => !this[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    
    const validTypes = ['VOA', 'ITK', 'ITAS', 'ITAP'];
    if (!validTypes.includes(this.type)) {
      throw new Error(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }
    
    const validStatus = ['ACTIVE', 'EXPIRED', 'DEPARTED'];
    if (!validStatus.includes(this.status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatus.join(', ')}`);
    }
    
    return true;
  }

  toJSON() {
    return {
      namaLengkap: this.namaLengkap,
      noPaspor: this.noPaspor,
      negara: this.negara,
      type: this.type,
      sponsor: this.sponsor,
      alamat: this.alamat,
      domisili: this.domisili,
      latitude: this.latitude,
      longitude: this.longitude,
      tanggalMasuk: this.tanggalMasuk,
      tanggalBerlaku: this.tanggalBerlaku,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy
    };
  }
}

module.exports = WNAModel;