import { Button } from "@/components/ui/button";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-blue-800 text-white">
      {/* Navigation */}
      <nav className="bg-white/10 backdrop-blur-sm border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <i className="fas fa-trophy text-white text-2xl mr-3"></i>
                <span className="text-xl font-bold text-white">SportSync</span>
              </div>
            </div>
            <Button onClick={handleLogin} variant="secondary">
              Sign In
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
                Manage Your Sports Events Like a Pro
              </h1>
              <p className="text-xl mb-8 text-blue-100">
                Create events, manage teams, coordinate schedules, and engage your sports community all in one powerful platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button onClick={handleLogin} size="lg" variant="secondary">
                  Get Started Free
                </Button>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-primary">
                  Watch Demo
                </Button>
              </div>
            </div>
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600" 
                alt="Sports team in action" 
                className="rounded-2xl shadow-2xl w-full h-auto"
              />
              <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center space-x-4">
                  <div className="bg-secondary p-3 rounded-lg">
                    <i className="fas fa-users text-white text-xl"></i>
                  </div>
                  <div>
                    <p className="text-neutral-900 font-semibold">1,200+</p>
                    <p className="text-neutral-500 text-sm">Active Teams</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Everything You Need</h2>
            <p className="text-xl text-blue-100">Powerful features for sports management</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="bg-white/20 p-4 rounded-lg w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <i className="fas fa-calendar text-2xl"></i>
              </div>
              <h3 className="text-xl font-semibold mb-2">Event Management</h3>
              <p className="text-blue-100">Create and manage sports events with ease</p>
            </div>
            
            <div className="text-center p-6">
              <div className="bg-white/20 p-4 rounded-lg w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <i className="fas fa-users text-2xl"></i>
              </div>
              <h3 className="text-xl font-semibold mb-2">Team Coordination</h3>
              <p className="text-blue-100">Organize teams and manage memberships</p>
            </div>
            
            <div className="text-center p-6">
              <div className="bg-white/20 p-4 rounded-lg w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <i className="fas fa-bell text-2xl"></i>
              </div>
              <h3 className="text-xl font-semibold mb-2">Smart Notifications</h3>
              <p className="text-blue-100">Stay updated with real-time alerts</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <i className="fas fa-trophy text-white text-2xl mr-3"></i>
              <span className="text-xl font-bold">SportSync</span>
            </div>
            <p className="text-blue-100 mb-6">
              The complete sports event management platform for teams, organizers, and athletes.
            </p>
            <p className="text-blue-200 text-sm">© 2024 SportSync. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
