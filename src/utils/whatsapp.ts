export const getWhatsAppUrl = (phone: string | null, name: string) => {
    if (!phone) return '#';
    // Strip all non-numeric characters
    let cleanPhone = phone.replace(/\D/g, '');
    
    // If it's a 10 digit number (standard in many countries like India, US), 
    // and assuming the user wants +91 (India) as default since that was the previous issue context
    if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone;
    }
    
    const text = encodeURIComponent(`Hi ${name}, `);
    return `https://wa.me/${cleanPhone}?text=${text}`;
};
