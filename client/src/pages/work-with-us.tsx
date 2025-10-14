import Navigation from "@/components/navigation";

export default function WorkWithUs() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: '56px', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
        {/* Page Title */}
        <h1 className="font-semibold leading-tight tracking-tight" style={{ fontSize: '80px', color: '#1D1D1F', marginBottom: '32px', lineHeight: '1.05' }} data-testid="work-title">
          Work With Us
        </h1>
        
        <div className="max-w-4xl" style={{ marginBottom: '80px' }}>
          <p className="leading-relaxed" style={{ fontSize: '22px', color: '#1D1D1F', marginBottom: '24px', lineHeight: '1.4' }}>
            Join our team and contribute to advancing cardiovascular research through innovative technology and clinical evidence.
          </p>
          <p className="leading-relaxed" style={{ fontSize: '22px', color: '#6E6E73', lineHeight: '1.4' }}>
            We are always looking for talented researchers, engineers, and clinicians passionate about improving cardiovascular health outcomes.
          </p>
        </div>

        {/* Opportunities Section */}
        <section style={{ marginBottom: '80px' }}>
          <h2 className="text-2xl font-semibold mb-8" style={{ color: '#1D1D1F' }}>Research Opportunities</h2>
          <div className="space-y-8">
            <div className="border-b border-gray-200 pb-8">
              <h3 className="text-xl font-medium mb-3" style={{ color: '#1D1D1F' }}>Clinical Research</h3>
              <p className="text-base leading-relaxed mb-4" style={{ color: '#6E6E73', lineHeight: '1.5' }}>
                Collaborate on clinical studies evaluating cardiovascular assessment technologies across diverse patient populations.
              </p>
            </div>
            
            <div className="border-b border-gray-200 pb-8">
              <h3 className="text-xl font-medium mb-3" style={{ color: '#1D1D1F' }}>Data Science & Analytics</h3>
              <p className="text-base leading-relaxed mb-4" style={{ color: '#6E6E73', lineHeight: '1.5' }}>
                Apply advanced analytics and machine learning to cardiovascular waveform analysis and outcome prediction.
              </p>
            </div>
            
            <div className="border-b border-gray-200 pb-8">
              <h3 className="text-xl font-medium mb-3" style={{ color: '#1D1D1F' }}>Device Development</h3>
              <p className="text-base leading-relaxed mb-4" style={{ color: '#6E6E73', lineHeight: '1.5' }}>
                Contribute to the development and validation of next-generation non-invasive cardiovascular monitoring devices.
              </p>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section style={{ marginBottom: '80px' }}>
          <h2 className="text-2xl font-semibold mb-8" style={{ color: '#1D1D1F' }}>Get in Touch</h2>
          <div className="bg-gray-50 rounded-2xl p-8">
            <p className="text-lg mb-6" style={{ color: '#1D1D1F', lineHeight: '1.5' }}>
              For research collaboration inquiries, please contact our team.
            </p>
            <a 
              href="mailto:research@conneqthealth.com" 
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors font-medium"
              data-testid="contact-button"
            >
              Contact Research Team
            </a>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center text-sm" style={{ color: '#6E6E73' }}>
            <p>© 2025 CONNEQT Health. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:opacity-70 transition-opacity">Privacy Policy</a>
              <a href="#" className="hover:opacity-70 transition-opacity">Terms of Use</a>
              <a href="#" className="hover:opacity-70 transition-opacity">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
