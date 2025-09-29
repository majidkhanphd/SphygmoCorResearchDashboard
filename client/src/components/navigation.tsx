export default function Navigation() {
  return (
    <header className="w-full bg-white border-b border-gray-200" data-testid="ml-header">
      <div className="mx-auto max-w-[980px] px-4 sm:px-6">
        <div className="flex h-14 items-center">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight leading-tight" data-testid="ml-title" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif', letterSpacing: '-0.02em' }}>
            SphygmoCor Cardiovascular Research
          </h1>
        </div>
        {/* Apple's specific gold accent */}
        <div className="h-px" style={{ background: 'linear-gradient(90deg, #ff9500 0%, #ffad33 50%, #ff9500 100%)' }} data-testid="gold-accent" />
      </div>
    </header>
  );
}
