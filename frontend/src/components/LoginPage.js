import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from '../App';
import { Eye, EyeOff, Users, CheckCircle } from 'lucide-react';

const LoginPage = () => {
  const { login, register, loading, error } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: ''
  });

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleRoleChange = (value) => {
    setFormData({
      ...formData,
      role: value
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login(formData.email, formData.password);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!formData.role) {
      return;
    }
    try {
      await register(formData.email, formData.password, formData.fullName, formData.role);
    } catch (error) {
      console.error('Register error:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-400 rounded-full opacity-10 blur-3xl animate-pulse-custom"></div>
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-purple-400 rounded-full opacity-10 blur-3xl animate-pulse-custom" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-indigo-400 rounded-full opacity-5 blur-3xl animate-pulse-custom" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8 animate-slideUp">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-lg">
              <Users className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold gradient-text mb-2">
            Collaborator Platform
          </h1>
          <p className="text-slate-600 text-lg">
            Streamline task management and performance tracking
          </p>
        </div>

        {/* Main Card */}
        <Card className="glass-effect border-0 shadow-2xl animate-slideUp" style={{animationDelay: '0.2s'}}>
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-semibold text-slate-800">Welcome Back</CardTitle>
            <CardDescription className="text-slate-600">
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100/80">
                <TabsTrigger value="login" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  Sign Up
                </TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-700 font-medium">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="form-input bg-white/80 border-slate-200 h-12 text-slate-800 placeholder:text-slate-400"
                      data-testid="login-email-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-slate-700 font-medium">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        className="form-input bg-white/80 border-slate-200 h-12 pr-12 text-slate-800 placeholder:text-slate-400"
                        data-testid="login-password-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                        data-testid="toggle-password-visibility"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 btn-primary text-white font-medium text-base shadow-lg hover:shadow-xl"
                    data-testid="login-submit-button"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <div className="loading-spinner mr-2"></div>
                        Signing In...
                      </div>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Register Tab */}
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-slate-700 font-medium">
                      Full Name
                    </Label>
                    <Input
                      id="fullName"
                      name="fullName"
                      type="text"
                      placeholder="Your full name"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      required
                      className="form-input bg-white/80 border-slate-200 h-12 text-slate-800 placeholder:text-slate-400"
                      data-testid="register-fullname-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="registerEmail" className="text-slate-700 font-medium">
                      Email Address
                    </Label>
                    <Input
                      id="registerEmail"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="form-input bg-white/80 border-slate-200 h-12 text-slate-800 placeholder:text-slate-400"
                      data-testid="register-email-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="registerPassword" className="text-slate-700 font-medium">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="registerPassword"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        className="form-input bg-white/80 border-slate-200 h-12 pr-12 text-slate-800 placeholder:text-slate-400"
                        data-testid="register-password-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-slate-700 font-medium">
                      Role
                    </Label>
                    <Select onValueChange={handleRoleChange} required>
                      <SelectTrigger className="bg-white/80 border-slate-200 h-12 text-slate-800" data-testid="role-select">
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager" data-testid="role-manager">
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="h-4 w-4 text-blue-500" />
                            <span>Manager</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="collaborator" data-testid="role-collaborator">
                          <div className="flex items-center space-x-2">
                            <Users className="h-4 w-4 text-green-500" />
                            <span>Collaborator</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 btn-primary text-white font-medium text-base shadow-lg hover:shadow-xl"
                    data-testid="register-submit-button"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <div className="loading-spinner mr-2"></div>
                        Creating Account...
                      </div>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm animate-fadeIn">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features */}
        <div className="mt-8 grid grid-cols-2 gap-4 animate-slideUp" style={{animationDelay: '0.4s'}}>
          <div className="text-center p-4 glass-effect rounded-lg">
            <div className="text-blue-500 mb-2">
              <CheckCircle className="h-6 w-6 mx-auto" />
            </div>
            <p className="text-sm text-slate-600 font-medium">Task Management</p>
          </div>
          <div className="text-center p-4 glass-effect rounded-lg">
            <div className="text-purple-500 mb-2">
              <Users className="h-6 w-6 mx-auto" />
            </div>
            <p className="text-sm text-slate-600 font-medium">Performance Tracking</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;