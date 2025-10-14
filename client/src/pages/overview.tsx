import Navigation from "@/components/navigation";
import { Link } from "wouter";

export default function Overview() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: '56px', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
        {/* Main Hero */}
        <h1 className="font-semibold leading-tight tracking-tight" style={{ fontSize: '80px', color: '#1D1D1F', marginBottom: '32px', lineHeight: '1.05' }} data-testid="overview-title">
          CONNEQT Health Research
        </h1>
        
        <div className="max-w-4xl" style={{ marginBottom: '80px' }}>
          <p className="leading-relaxed" style={{ fontSize: '22px', color: '#1D1D1F', marginBottom: '24px', lineHeight: '1.4' }}>
            We advance non-invasive cardiovascular assessment through innovative technology, measuring central blood pressure, arterial stiffness, and hemodynamic parameters to improve clinical outcomes across hypertension, chronic kidney disease, and heart failure.
          </p>
          <p className="leading-relaxed" style={{ fontSize: '22px', color: '#6E6E73', lineHeight: '1.4' }}>
            Our publications span pulse wave analysis, carotid-femoral pulse wave velocity, vascular aging, device validation, and clinical evidence across diverse populations.
          </p>
        </div>

        {/* Research Highlights Section */}
        <section style={{ marginBottom: '80px' }}>
          <h2 className="text-xl font-semibold mb-8" style={{ color: '#1D1D1F' }}>Featured Research Highlights</h2>
          <div className="space-y-8">
            <div className="border-b border-gray-200 pb-8">
              <p className="text-sm mb-2" style={{ color: '#6E6E73' }}>Coming soon</p>
              <p className="text-base leading-relaxed" style={{ color: '#1D1D1F', lineHeight: '1.5' }}>
                Research highlights will showcase our latest cardiovascular studies and findings.
              </p>
            </div>
          </div>
          <Link href="/highlights">
            <a className="text-base font-medium mt-6 inline-block apple-transition" style={{ color: '#007AFF' }} data-testid="view-highlights-link">
              View all highlights
            </a>
          </Link>
        </section>

        {/* Recent Publications Section */}
        <section style={{ marginBottom: '80px' }}>
          <h2 className="text-xl font-semibold mb-8" style={{ color: '#1D1D1F' }}>Recent Publications</h2>
          <div className="space-y-8">
            <div className="border-b border-gray-200 pb-8">
              <p className="text-sm mb-2" style={{ color: '#6E6E73' }}>No publications yet</p>
              <p className="text-base leading-relaxed" style={{ color: '#1D1D1F', lineHeight: '1.5' }}>
                Browse our complete collection of cardiovascular research publications.
              </p>
            </div>
          </div>
          <Link href="/research">
            <a className="text-base font-medium mt-6 inline-block apple-transition" style={{ color: '#007AFF' }} data-testid="explore-publications-link">
              Explore all publications
            </a>
          </Link>
        </section>

        {/* Events Section */}
        <section style={{ marginBottom: '80px' }}>
          <h2 className="text-xl font-semibold mb-8" style={{ color: '#1D1D1F' }}>Upcoming Events</h2>
          <div className="space-y-8">
            <div className="border-b border-gray-200 pb-8">
              <p className="text-sm mb-2" style={{ color: '#6E6E73' }}>Coming soon</p>
              <p className="text-base leading-relaxed" style={{ color: '#1D1D1F', lineHeight: '1.5' }}>
                Stay updated on conferences, workshops, and research events.
              </p>
            </div>
          </div>
          <Link href="/updates">
            <a className="text-base font-medium mt-6 inline-block apple-transition" style={{ color: '#007AFF' }} data-testid="view-events-link">
              View all events
            </a>
          </Link>
        </section>

        {/* Bottom CTA Banner */}
        <section className="py-16 mb-16">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-12 text-center">
            <h2 className="text-3xl font-semibold mb-4" style={{ color: '#1D1D1F' }}>
              Discover opportunities in Cardiovascular Research
            </h2>
            <p className="text-lg mb-8" style={{ color: '#6E6E73' }}>
              Our research in cardiovascular assessment breaks new ground every day.
            </p>
            <Link href="/work-with-us">
              <a className="inline-block px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors font-medium" data-testid="work-with-us-cta">
                Work with us
              </a>
            </Link>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
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
