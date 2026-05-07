'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useCreateClub } from '@/lib/hooks/useClubs';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

const CLUB_CATEGORIES = [
  'Academic',
  'Arts',
  'Sports',
  'Technology',
  'Community Service',
  'Cultural',
  'Professional',
  'Recreation',
  'Other',
];

export default function CreateClubPage() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    coverPhotoUrl: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { mutate: createClub, isPending } = useCreateClub();

  // Cleanup preview URL on unmount or change
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Redirect if not authenticated
  if (isLoading || !isAuthenticated) {
    return null;
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Club name is required';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Club name must be at least 3 characters';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Club name must be less than 100 characters';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      let finalCoverPhotoUrl = formData.coverPhotoUrl;

        if (file) {
        setIsUploading(true);
        
        // Use our proxy API to upload
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);

        const token = localStorage.getItem('eagleconnect_auth_token'); // Get raw token for header

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: uploadFormData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to upload image');
        }

        const data = await response.json();
        finalCoverPhotoUrl = data.data.url;
      }

      createClub(
        {
          name: formData.name,
          description: formData.description || undefined,
          category: formData.category,
          coverPhotoUrl: finalCoverPhotoUrl || undefined,
        },
        {
          onSuccess: (data) => {
            router.push(`/clubs/${data.clubId}`);
          },
          onError: (error) => {
             // Handle creation error
             console.error("Creation failed", error);
             setIsUploading(false);
          }
        }
      );
    } catch (error: any) {
      console.error('Error creating club:', error);
      const errorMessage = typeof error === 'string' ? error : error.message || JSON.stringify(error);
      setErrors({ ...errors, form: errorMessage || 'Failed to create club. Please try again.' });
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container max-w-2xl px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Create a New Club</CardTitle>
            <CardDescription>
              Start building your community by creating a club
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Club Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter club name"
                  maxLength={100}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formData.name.length}/100 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">
                  Category <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLUB_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-sm text-destructive">{errors.category}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Tell us about your club..."
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="coverPhoto">Cover Photo (Optional)</Label>
                <div className="flex flex-col gap-4">
                  <Input
                    id="coverPhoto"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (previewUrl) {
                          URL.revokeObjectURL(previewUrl);
                        }
                        setFile(file);
                        // Create preview URL
                        const url = URL.createObjectURL(file);
                        setPreviewUrl(url);
                      }
                    }}
                    disabled={isUploading}
                  />
                  {previewUrl && (
                    <div className="relative w-full h-48 rounded-md overflow-hidden bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl || "/placeholder.svg"}
                        alt="Cover photo preview"
                        className="object-cover w-full h-full"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          if (previewUrl) {
                            URL.revokeObjectURL(previewUrl);
                          }
                          setFile(null);
                          setPreviewUrl(null);
                          setFormData({ ...formData, coverPhotoUrl: '' });
                          // Reset file input
                          const fileInput = document.getElementById('coverPhoto') as HTMLInputElement;
                          if (fileInput) fileInput.value = '';
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Upload an image for your club cover (Max 5MB)
                  </p>
                </div>
              </div>

              {errors.form && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                  {errors.form}
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending || isUploading}
                  className="flex-1"
                >
                  {isUploading ? 'Uploading...' : isPending ? 'Creating...' : 'Create Club'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
