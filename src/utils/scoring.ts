export function getLeadScoreBadge(lead: any) {
  // Hot if missing website, or rating < 4.0, or reviews < 10
  let isHot = false;
  if (!lead.website || lead.website.trim() === '') isHot = true;
  if (lead.rating && parseFloat(lead.rating) < 4.0) isHot = true;
  
  let reviewCount = 0;
  if (lead.reviews) {
     reviewCount = parseInt(lead.reviews.toString().replace(/\D/g, ''));
     if (!isNaN(reviewCount) && reviewCount < 10) isHot = true;
  }
  
  // Cold if rating >= 4.5 and reviews > 100
  let isCold = false;
  if (lead.rating && parseFloat(lead.rating) >= 4.5 && !isNaN(reviewCount) && reviewCount > 100) {
     isCold = true;
  }

  // If it matches both (e.g. no website but high rating), prioritize HOT because lack of website is a huge marketing opportunity.
  if (isHot) {
    return { label: '🔥 HOT', classes: 'bg-red-500/10 text-red-500 border-red-500/20' };
  }
  if (isCold) {
    return { label: '🧊 COLD', classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
  }
  return { label: '🌟 WARM', classes: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
}
