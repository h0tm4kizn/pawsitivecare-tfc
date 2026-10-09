import React, { useState } from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import { apiFetch } from '../api/apiClient';

export default function Contact() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSending(true);
    setSendError('');
    try {
      const res = await apiFetch('/api/contact-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || 'Failed to send message.');
      }
      setSent(true);
      setFormData({ name: '', email: '', phone: '', message: '' });
      setTimeout(() => setSent(false), 4000);
    } catch (err) {
      setSendError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const contactInfo = [
    { icon: Mail,   label: 'Email',    value: 'connect.thefurclub@gmail.com', color: 'bg-brand-pink'  },
    { icon: Phone,  label: 'Phone',    value: '0976 065 8031',                color: 'bg-brand-pink'  },
    { icon: MapPin, label: 'Location', value: '207 F. Blumentritt St. Kabayanan, San Juan City, 1550', color: 'bg-brand-pink' },
  ];

  return (
    <section id="contact" className="w-full px-6 md:px-12 lg:px-24 py-20 scroll-mt-24 bg-white">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12">

        {/* Left: Info */}
        <div className="flex flex-col justify-center">
          <div className="mb-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-teal-soft px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-dark">
              <i className="fa-solid fa-paw" /> Contact Us
            </span>
          </div>
          <h2 className="text-2xl font-extrabold leading-tight text-brand-dark md:text-4xl mb-5">
            Questions? We're{' '}<br />
            <span className="text-brand-orange">here to help.</span>
          </h2>
          <p className="font-poppins text-brand-dark text-base leading-relaxed mb-8">
            Have questions about our grooming, daycare, or hotel services? We'd love to hear from you!
            Reach out to our friendly staff at The Fur Club Pet Station to schedule your pet's next visit
            or to learn more about how we can pamper your furry best friend.
          </p>

          <div className="space-y-4">
            {contactInfo.map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="flex items-center gap-4">
                <div className={`w-10 h-10 ${color} rounded-full flex items-center justify-center shrink-0 shadow-md`}>
                  <Icon size={20} className="text-white" />
                </div>
                <div>
                  <h4 className="font-poppins font-semibold text-brand-dark text-sm">{label}</h4>
                  <p className="font-poppins text-brand-dark text-sm">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Form */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-brand-dark/20 shadow-sm">
          <h3 className="font-bauhaus font-extrabold text-2xl text-brand-dark mb-6">Send us a Message</h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { id: 'name',    label: 'Name',            type: 'text',  placeholder: 'Your name',           required: true },
              { id: 'email',   label: 'Email',           type: 'email', placeholder: 'your@email.com',       required: true },
              { id: 'phone',   label: 'Phone (Optional)', type: 'tel',   placeholder: '+63 (917) 123-4567',  required: false },
            ].map(({ id, label, type, placeholder, required }) => (
              <div key={id}>
                <label htmlFor={id} className="block font-poppins text-sm font-semibold text-brand-dark mb-2">{label}</label>
                <input
                  id={id}
                  type={type}
                  name={id}
                  value={formData[id]}
                  onChange={handleChange}
                  required={required}
                  placeholder={placeholder}
                  className={`w-full px-4 py-2 border border-brand-dark/40 rounded-xl font-poppins text-sm text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-teal ${id === 'name' ? 'placeholder-gray-400' : ''}`}
                />
              </div>
            ))}

            <div>
              <label htmlFor="message" className="block font-poppins text-sm font-semibold text-brand-dark mb-2">Message</label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows="5"
                placeholder="Tell us about your furry friends..."
                className="w-full px-4 py-2 border border-brand-teal/40 rounded-xl font-poppins text-sm text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-teal resize-none"
              />
            </div>

            {sendError && <p className="font-poppins text-sm text-red-500">{sendError}</p>}
            {sent     && <p className="font-poppins text-sm text-green-600 font-semibold">Message sent! We'll get back to you soon.</p>}

            <button
              type="submit"
              disabled={isSending}
              className="w-full bg-brand-teal text-brand-white font-poppins font-semibold py-3 rounded-full hover:bg-brand-orange transition-all shadow-lg mt-2 disabled:opacity-60"
            >
              {isSending ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
