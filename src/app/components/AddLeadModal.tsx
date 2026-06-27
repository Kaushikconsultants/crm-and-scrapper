import { useState } from 'react';
import { X, Save, User, MapPin, Building2, Globe, Phone } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function AddLeadModal({ 
  isOpen, 
  onClose, 
  currentUserId,
  onLeadAdded 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  currentUserId?: string;
  onLeadAdded: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    location: '',
    category: '',
    website: ''
  });

  const supabase = createClient();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('leads').insert([{
        name: formData.name,
        phone: formData.phone || null,
        location: formData.location || null,
        category: formData.category || null,
        website: formData.website || null,
        assigned_to: currentUserId || null,
        status: 'New',
        source_platform: 'Manual Entry'
      }]);

      if (error) throw error;

      alert('Lead added successfully!');
      onLeadAdded();
      onClose();
      setFormData({ name: '', phone: '', location: '', category: '', website: '' });
    } catch (err: any) {
      alert(`Error adding lead: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-100 border border-gray-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-white">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            Add Manual Lead
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Business Name *</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                required
                type="text" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-white border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. Apex Plumbers"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="tel" 
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full bg-white border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                value={formData.location}
                onChange={e => setFormData({...formData, location: e.target.value})}
                className="w-full bg-white border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. Delhi"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Category</label>
            <input 
              type="text" 
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
              className="w-full bg-white border border-gray-700 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. Plumbers"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Website</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="url" 
                value={formData.website}
                onChange={e => setFormData({...formData, website: e.target.value})}
                className="w-full bg-white border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://example.com"
              />
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-gray-200 bg-white flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading || !formData.name}
            className="px-4 py-2 rounded-lg bg-blue-600 text-gray-900 font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? 'Saving...' : <><Save className="w-4 h-4" /> Save Lead</>}
          </button>
        </div>
      </div>
    </div>
  );
}
