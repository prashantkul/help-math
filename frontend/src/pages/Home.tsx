import { Link } from 'react-router-dom';
import { GraduationCap, Users } from 'lucide-react';
import { Button, Card } from '../components/common';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-orange-50 flex flex-col">
      {/* Header */}
      <header className="p-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🧮</span>
            <h1 className="text-2xl font-bold text-gray-800">Math Helper</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
              Learn Math Step by Step
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              A friendly way to solve word problems. We break them down into easy steps so you can succeed!
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Student Card */}
            <Card variant="warm" padding="lg" className="text-center">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-5xl">🎒</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">I'm a Student</h3>
              <p className="text-gray-600 mb-6">
                Ready to solve some math problems? Join your class and start learning!
              </p>
              <Link to="/student/login">
                <Button variant="secondary" size="lg" className="w-full">
                  <Users className="w-5 h-5 mr-2" />
                  Join My Class
                </Button>
              </Link>
            </Card>

            {/* Teacher Card */}
            <Card variant="default" padding="lg" className="text-center">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-5xl">📚</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">I'm a Teacher</h3>
              <p className="text-gray-600 mb-6">
                Create scaffolded word problems for your students and track their progress.
              </p>
              <Link to="/teacher/login">
                <Button variant="primary" size="lg" className="w-full">
                  <GraduationCap className="w-5 h-5 mr-2" />
                  Teacher Portal
                </Button>
              </Link>
            </Card>
          </div>

          {/* Features */}
          <div className="mt-16 grid md:grid-cols-3 gap-6 text-center">
            <div>
              <span className="text-4xl block mb-3">🎯</span>
              <h4 className="font-bold text-gray-800 mb-1">Step by Step</h4>
              <p className="text-gray-600 text-sm">
                Problems broken into small, easy pieces
              </p>
            </div>
            <div>
              <span className="text-4xl block mb-3">🔊</span>
              <h4 className="font-bold text-gray-800 mb-1">Read Aloud</h4>
              <p className="text-gray-600 text-sm">
                Listen to problems being read to you
              </p>
            </div>
            <div>
              <span className="text-4xl block mb-3">⭐</span>
              <h4 className="font-bold text-gray-800 mb-1">Earn Stars</h4>
              <p className="text-gray-600 text-sm">
                Get rewarded for every step you complete
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-gray-500 text-sm">
        <p>Made with love for students learning math</p>
      </footer>
    </div>
  );
}
