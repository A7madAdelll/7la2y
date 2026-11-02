// Egyptian mobile: 01 + operator digit (0,1,2,5) + 8 digits. Landlines are not accepted.
export const isEgyptianMobile = (phone: string) => /^01[0125]\d{8}$/.test(phone);
