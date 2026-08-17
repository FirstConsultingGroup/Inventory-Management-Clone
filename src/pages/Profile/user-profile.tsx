import { useEffect, useState } from 'react'
import {
    Card, CardDescription, CardHeader, CardTitle,
    CardContent, CardFooter
} from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Badge } from '../../components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar'
import toast from 'react-hot-toast'
import { User, Mail, UserCircle, Shield, Camera, AlertCircle, Loader2, Trash2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { supabase } from '@/Utils/types/supabaseClient'
import { fetchUserPermissions, type ModuleKey } from '@/constants/permissions'
import { IUser } from '@/Utils/constants'
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog'
import QrCodeSection from './QrCodeSection'
import { useDispatch ,useSelector } from "react-redux";
import {  setUser as setReduxUser  } from "@/redux/features/userSlice";


type ExtendedIUser = IUser & {
  company_data?: any;
  stores?:any;
};

const UserProfile = () => {
    const currentUser = localStorage.getItem("userData");
    const userData = JSON.parse(currentUser || '{}');

    const [user, setUser] = useState({
        firstName: '',
        lastName: '',
        fullName: '',
        email: '',
        role: 'user',
        status: 'active',
        profileImage: "/api/placeholder/100/100",
        securityQuestion: '',
        secretAnswer: '',
    });

    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({ ...user });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [accessToken, setAccessToken] = useState<string | undefined>();
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const [allowedModules, setAllowedModules] = useState<ModuleKey[]>([]);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imageRemoved, setImageRemoved] = useState(false);
    const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const dispatch = useDispatch();

    const reduxUser = useSelector((state: any) => state.user);

    useEffect(() => {
    console.log("Redux State:", reduxUser);
}, [reduxUser]);

    // Predefined security questions
    const securityQuestions = [
        "What was the name of your first school?",
        "What is the name of your childhood best friend?",
        "What was the make and model of your first vehicle?",
        "In what city were you born?",
        "What was the name of your first pet?",
        "What is your mother's maiden name?"
    ];

    useEffect(() => {
        const getAccessToken = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setAccessToken(session?.access_token);
        }
        getAccessToken();
    }, [])


    useEffect(() => {
        setFormData({ ...user });
    }, [user]);

    const handleChange = (e: any) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        
        // Clear error when user starts typing
        if (formErrors[name]) {
            setFormErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    // Handle select change for security question
    const handleSelectChange = (value: string) => {
        setFormData(prev => ({
            ...prev,
            securityQuestion: value
        }));
        
        // Clear error when user selects a question
        if (formErrors.securityQuestion) {
            setFormErrors(prev => ({
                ...prev,
                securityQuestion: ''
            }));
        }
    };

    // Handle image change
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        setSelectedImage(file || null);
        setImageRemoved(false);
        
        if (file) {
            // Validate file type
            if (!['image/jpeg', 'image/png'].includes(file.type)) {
                setFormErrors(prev => ({
                    ...prev,
                    image: 'Image must be a JPG or PNG file'
                }));
                return;
            }
            
            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                setFormErrors(prev => ({
                    ...prev,
                    image: 'Image must be less than 5MB'
                }));
                return;
            }
            
            // Clear any previous image errors
            setFormErrors(prev => ({
                ...prev,
                image: ''
            }));
            
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setImagePreview(null);
        }
    };

    const handleRemoveImage = () => {
        setSelectedImage(null);
        setImagePreview(null);
        setImageRemoved(true);
    }

    // Form validation
    const validateForm = () => {
        const errors: {[key: string]: string} = {};
        
        if (!formData.firstName.trim()) {
            errors.firstName = 'First name is required';
        } else if (!/^[A-Za-z]+(?:\s[A-Za-z]+)*$/.test(formData.firstName)) {
            errors.firstName = 'First name can contain only letters';
        }
        
        if (!formData.lastName.trim()) {
            errors.lastName = 'Last name is required';
        } else if (!/^[A-Za-z]+(?:\s[A-Za-z]+)*$/.test(formData.lastName)) {
            errors.lastName = 'Last name can contain only letters';
        }
        
        if (!formData.email.trim()) {
            errors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = 'Invalid email address';
        } else if (formData.email !== formData.email.toLowerCase()) {
            errors.email = 'Email must not contain uppercase letters';
        }

        // Security question & answer validation
        if (formData.securityQuestion && !formData.secretAnswer.trim()) {
            errors.secretAnswer = 'Secret answer is required when a security question is selected';
        } else if (!formData.securityQuestion && formData.secretAnswer.trim()) {
            errors.securityQuestion = 'Please select a security question when providing an answer';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const getRoleName = async (roleId: string | null) => {
        const { data, error, status } = await supabase
            .from('role_master')
            .select('*')
            .eq('id', roleId!)
            .single()

        console.log(' Query response:===>', { data, error, status });
        if (data) {
            return data.name
        }
    }

    useEffect(() => {
        fetchUserData();
    }, [])

    const fetchUserData = async () => {
        try {
            const { data: userDetails, error } = await supabase
                .from('user_mgmt')
                .select(`
        *, 
        company_data:company_id(*),
        department_master:department_id (
          id,
          department_name,
          department_id
        )
      `)
      .eq('id', userData.id)
      .single();

            if (error) {
                console.error("Fetch error:", error);
                toast.error("Error fetching user details.");
                return;
            }

            const data = userDetails as ExtendedIUser;
            if (data) {
                const roleName = await getRoleName(data.role_id);
                
                // Get profile image URL if exists
                let profileImageUrl = "/api/placeholder/100/100";
                if (data.image) {
                    const imageMetadata = data.image as any;
                    if (imageMetadata.path) {
                        const { data: publicUrlData } = supabase.storage
                            .from('profile-picture')
                            .getPublicUrl(imageMetadata.path);
                        
                        if (publicUrlData?.publicUrl) {
                            profileImageUrl = publicUrlData.publicUrl;
                        }
                    }
                }
                
                // Build the updated user object
                const updatedUserData = {
      id: data.id,
      email: data.email,
      email_confirmed: userData.email_confirmed ?? true,
      created_at: data.created_at,
      last_sign_in: userData.last_sign_in || null,
      first_name: data.first_name,
      last_name: data.last_name,
      user_id: data.id,
      role_id: data.role_id,
      role_name: roleName,
      status: data.status,
      is_active: data.is_active,
      company_id: data.company_id,
      company_data: data.company_data || null,
      full_name: `${data.first_name} ${data.last_name}`.trim(),
      image: data.image || null,
      department_id: data.department_id || null,
      locations: data.locations || null,
       stores: data.stores || null,  
      approve_authorizations: data.approve_authorizations || null,
    };

    // Save to localStorage
    localStorage.setItem("userData", JSON.stringify(updatedUserData));

    console.log("After LocalStorage:", JSON.parse(localStorage.getItem("userData") || "{}"));
    

// Redux update
dispatch(setReduxUser(updatedUserData));

console.log("Redux Payload:", updatedUserData);


                setUser({
                    firstName: data.first_name || '',
                    lastName: data.last_name || '',
                    fullName: `${data.first_name} ${data.last_name}` || '',
                    email: data.email || '',
                    role: roleName || 'user',
                    status: data.status || 'active',
                    profileImage: profileImageUrl,
                    securityQuestion: data.security_question || '',
                    secretAnswer: data.secret_answer || '',
                });
                
                // Set image preview for editing
                setImagePreview(profileImageUrl);

                // Fetch role authorizations for this user
                if (data.id && data.company_id) {
                    const perms = await fetchUserPermissions(data.id, data.company_id);
                    if (perms?.permissions) {
                        const modules = Object.entries(perms.permissions)
                            .filter(([_, allowed]) => !!allowed)
                            .map(([module]) => module as ModuleKey)
                            .sort();
                        setAllowedModules(modules);
                    } else {
                        setAllowedModules([]);
                    }
                }
            }
        } catch (error: any) {
            toast.error(error?.message || 'Failed to fetch profile');
            console.error('Error fetching user data:', error);
        }
    }

    const handleSubmit = async () => {
        if (!validateForm()) {
            toast.error('Please fix the form errors before submitting');
            return;
        }

        setIsSubmitting(true);
        try {
            // Check if email already exists (excluding current user)
            const { data: existingUsers, error: checkError } = await supabase
                .from('user_mgmt')
                .select('id, email')
                .eq('email', formData.email)
                .neq('id', userData.id);

            if (checkError) {
                throw checkError;
            }

            if (existingUsers && existingUsers.length > 0) {
                throw new Error('Email already exists');
            }

            // Handle image upload/removal
            let imageMetadata: any = null;
            let existingImageMetadata: any = null;

            // Fetch existing image metadata
            const { data: userDataCurrent, error: fetchError } = await supabase
                .from('user_mgmt')
                .select('image')
                .eq('id', userData.id)
                .single();
            
            if (fetchError) throw fetchError;
            existingImageMetadata = userDataCurrent.image;

            // Helper to normalize storage path in case a full URL was stored
            const normalizePath = (rawPath: string) => {
                if (!rawPath) return rawPath;
                try {
                    // If it's a full URL, reliably extract the part after '/profile-picture/'
                    if (/^https?:\/\//.test(rawPath)) {
                        const split = rawPath.split('/profile-picture/');
                        if (split.length > 1) {
                            return split[1].replace(/^\//, '');
                        }
                    }
                    // Otherwise remove any accidental leading slashes
                    return rawPath.replace(/^\/+/, '');
                } catch {
                    return rawPath;
                }
            };

            // Case 1: Image explicitly removed
            if (imageRemoved) {
                if (existingImageMetadata?.path) {
                    const deleteKey = normalizePath(existingImageMetadata.path);
                    console.log('Deleting profile image via edge with key:', deleteKey);
                    try {
                        const res = await fetch(`${supabaseUrl}functions/v1/delete-profile-image`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${supabaseAnonKey}`
                            },
                            body: JSON.stringify({ filePath: deleteKey })
                        });
                        const result = await res.json();
                        if (!res.ok) {
                            console.error('Edge deletion failed:', result.error || result.message || res.statusText);
                            toast.error('Failed to delete image from storage');
                        } else {
                            console.log('Edge deletion response:', result);
                        }
                    } catch (err: any) {
                        console.error('Error calling delete-profile-image:', err?.message || err);
                        toast.error('Failed to delete image from storage');
                    }
                }
                imageMetadata = null;
            }
            // Case 2: New image file selected - upload new and delete old
            else if (selectedImage instanceof File) {
                // Delete old image if exists before uploading new one
                if (existingImageMetadata?.path) {
                    const deleteKey = normalizePath(existingImageMetadata.path);
                    console.log('Deleting old image via edge with key:', deleteKey);
                    try {
                        const res = await fetch(`${supabaseUrl}functions/v1/delete-profile-image`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${supabaseAnonKey}`
                            },
                            body: JSON.stringify({ filePath: deleteKey })
                        });
                        const result = await res.json();
                        if (!res.ok) {
                            console.error('Edge deletion failed:', result.error || result.message || res.statusText);
                            toast.error('Failed to delete old image from storage');
                        } else {
                            console.log('Old image edge deletion response:', result);
                        }
                    } catch (err: any) {
                        console.error('Error calling delete-profile-image for old image:', err?.message || err);
                        toast.error('Failed to delete old image from storage');
                    }
                }

                // Upload new image
                const fileExt = selectedImage.name.split('.').pop();
                const fileName = `${formData.email.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${fileExt}`;
                const filePath = `${fileName}`;
                
                console.log('Uploading new image:', filePath);
                const { error: uploadError } = await supabase.storage
                    .from('profile-picture')
                    .upload(filePath, selectedImage);
                if (uploadError) throw new Error(uploadError.message);
                
                imageMetadata = {
                    name: selectedImage.name,
                    type: selectedImage.type,
                    size: selectedImage.size,
                    path: filePath,
                };
                console.log('Successfully uploaded new image');
            } 
            // Case 3: No change to image - keep existing
            else if (existingImageMetadata) {
                console.log('Keeping existing image:', existingImageMetadata.path);
                imageMetadata = existingImageMetadata;
            }

            const edgeRes = await fetch(`${supabaseUrl}functions/v1/update-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ id: userData.id, email: formData.email }),
            });

            if (!edgeRes.ok) {
                throw new Error('Failed to update auth user');
            }

            if (edgeRes.status === 200) {
                const { data, error } = await supabase
                    .from('user_mgmt')
                    .update({
                        first_name: formData.firstName,
                        last_name: formData.lastName,
                        email: formData.email,
                        image: imageMetadata,
                        security_question: formData.securityQuestion || null,
                        secret_answer: formData.secretAnswer || null,
                    })
                    .eq('id', userData.id)
                    .select()

                if (error) {
                    console.error("Update error:", error);
                    toast.error("Error updating user details.");
                    return;
                }

                if (data) {
                    await fetchUserData();
                    // setIsEditing(false);
                    setSelectedImage(null);
                    setImageRemoved(false);
                    toast.success('Profile updated successfully!');

                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                }
            }
        }
        catch (error: any) {
            toast.error(error?.message || 'Failed to update profile');
            console.error('Error submitting form:', error);
        }
        finally {
            setIsSubmitting(false);
        }
    };

    const getStatusColor = (status: any) => {
        switch (status.toLowerCase()) {
            case 'active': return 'bg-green-500 hover:bg-green-600';
            case 'inactive': return 'bg-gray-500 hover:bg-gray-600';
            case 'pending': return 'bg-amber-500 hover:bg-amber-600';
            case 'suspended': return 'bg-red-500 hover:bg-red-600';
            default: return 'bg-green-500 hover:bg-green-600';
        }
    };

    return (
        <div className="p-4 md:p-8 bg-gradient-to-br from-gray-100 to-blue-50 min-h-screen">
            <div className="mx-auto max-w-5xl">
                <Card className="shadow-2xl border border-gray-200 overflow-hidden rounded-2xl">
                    <CardHeader className="rounded-t-2xl border-b pb-4 pt-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <CardTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                    <UserCircle className="h-6 w-6 text-blue-600" />
                                    User Profile
                                </CardTitle>
                                <CardDescription className="mt-1 text-gray-600">
                                    Manage your personal details, account settings, and authorizations
                                </CardDescription>
                            </div>
                            {!isEditing && (
                                <div>
                                    <Button
                                    className='me-2'
                                        onClick={() => setIsDialogOpen(true)}
                                    >
                                        Change Password
                                    </Button>
                                    <Button onClick={() => setIsEditing(true)}>
                                        Edit Profile
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardHeader>

                    <CardContent className="pt-8 pb-6 px-6 md:px-8">
                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="flex flex-col items-center space-y-4">
                                <div className="relative">
                                    <Avatar className="h-36 w-36 border-4 border-white shadow-xl rounded-full transition-transform hover:scale-105">
                                        <AvatarImage 
                                            src={imageRemoved ? "/api/placeholder/100/100" : (imagePreview || user.profileImage)} 
                                            alt={user.fullName} 
                                            className="object-cover"
                                            onError={(e) => {
                                                // Fallback to placeholder if image fails to load
                                                e.currentTarget.src = "/api/placeholder/100/100";
                                            }}
                                        />
                                        <AvatarFallback className="text-3xl bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600">
                                            <b>{user.fullName.split(' ').map((n: any) => n[0]).join('')}</b>
                                        </AvatarFallback>
                                    </Avatar>
                                    <Badge className={`${getStatusColor(user.status)} absolute bottom-4 right-0 text-white px-3 py-1 rounded-full capitalize shadow-md`}>
                                        {user.status}
                                    </Badge>
                                    
                                    {/* Image controls - only show in edit mode */}
                                    {isEditing && (
                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 flex gap-2">
                                            <label
                                                htmlFor="profile-image"
                                                className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full cursor-pointer shadow-lg transition-colors duration-200"
                                            >
                                                <Camera className="h-4 w-4" />
                                                <input
                                                    id="profile-image"
                                                    type="file"
                                                    accept=".jpg,.jpeg,.png"
                                                    onChange={handleImageChange}
                                                    className="hidden"
                                                />
                                            </label>
                                            {imagePreview && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            type="button"
                                                            onClick={handleRemoveImage}
                                                            className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-full cursor-pointer shadow-lg transition-colors duration-200"
                                                            aria-label="Remove profile photo"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Remove profile photo</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Image upload error */}
                                {isEditing && formErrors.image && (
                                    <p className="text-sm text-red-500 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        {formErrors.image}
                                    </p>
                                )}
                                
                                {/* Image upload info */}
                                {isEditing && (
                                    <p className="text-xs text-gray-500 text-center max-w-xs">
                                        Upload a professional photo. Recommended: Square image, at least 200x200 pixels.
                                    </p>
                                )}
                                
                                <div className="bg-gray-50 rounded-full px-4 py-1 text-sm font-medium text-gray-600 border flex items-center gap-1 mt-2">
                                    <Shield className="h-4 w-4" />
                                    <span className="capitalize">{user.role}</span>
                                </div>
                                
                                {!isEditing && userData?.id && (
                                    <div className="mt-6 w-full flex justify-center">
                                        <QrCodeSection userId={userData.id} />
                                    </div>
                                )}
                            </div>

                            {!isEditing ? (
                                <div className="flex-1 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                                                <User className="h-4 w-4 text-blue-500" />
                                                <p>Full Name</p>
                                            </div>
                                            <p className="text-base font-semibold text-gray-800">{user.fullName}</p>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                                                <Mail className="h-4 w-4 text-blue-500" />
                                                <p>Email Address</p>
                                            </div>
                                            <p className="text-base font-semibold text-gray-800">{user.email}</p>
                                        </div>
                                        <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                                                <Shield className="h-4 w-4 text-blue-500" />
                                                <p>Authorizations</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-2 border border-gray-200 rounded-md p-3">
                                                {allowedModules.length > 0 ? (
                                                    allowedModules.map((auth) => (
                                                        <Badge key={auth} variant="secondary" className="px-3 py-1 rounded-full">
                                                            {auth}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <p className="text-sm text-gray-500">No authorizations assigned</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 mt-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-100 shadow-inner">
                                        <div className="space-y-2">
                                            <Label htmlFor="firstName" className="flex items-center gap-2 text-gray-700 font-medium">
                                                <User className="h-4 w-4 text-blue-600" />
                                                First Name <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id="firstName"
                                                name="firstName"
                                                value={formData.firstName}
                                                onChange={handleChange}
                                                className={`${formErrors.firstName
                                                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                                                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                                                } transition-all duration-200`}
                                            />
                                            {formErrors.firstName && (
                                                <p className="text-sm text-red-500 flex items-center gap-1">
                                                    <AlertCircle className="h-3 w-3" />
                                                    {formErrors.firstName}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="lastName" className="flex items-center gap-2 text-gray-700 font-medium">
                                                <User className="h-4 w-4 text-blue-600" />
                                                Last Name <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id="lastName"
                                                name="lastName"
                                                value={formData.lastName}
                                                onChange={handleChange}
                                                className={`${formErrors.lastName
                                                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                                                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                                                } transition-all duration-200`}
                                            />
                                            {formErrors.lastName && (
                                                <p className="text-sm text-red-500 flex items-center gap-1">
                                                    <AlertCircle className="h-3 w-3" />
                                                    {formErrors.lastName}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label htmlFor="email" className="flex items-center gap-2 text-gray-700 font-medium">
                                                <Mail className="h-4 w-4 text-blue-600" />
                                                Email Address <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id="email"
                                                name="email"
                                                type="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                className={`${formErrors.email
                                                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                                                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                                                } transition-all duration-200`}
                                            />
                                            {formErrors.email && (
                                                <p className="text-sm text-red-500 flex items-center gap-1">
                                                    <AlertCircle className="h-3 w-3" />
                                                    {formErrors.email}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label htmlFor="securityQuestion" className="flex items-center gap-2 text-gray-700 font-medium">
                                                <Shield className="h-4 w-4 text-blue-600" />
                                                Security Question
                                            </Label>
                                            <Select
                                                name="securityQuestion"
                                                value={formData.securityQuestion}
                                                onValueChange={handleSelectChange}
                                            >
                                                <SelectTrigger className={`${formErrors.securityQuestion
                                                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                                                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                                                } transition-all duration-200`}>
                                                    <SelectValue placeholder="Select a security question" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {securityQuestions.map((question) => (
                                                        <SelectItem key={question} value={question}>
                                                            {question}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {formErrors.securityQuestion && (
                                                <p className="text-sm text-red-500 flex items-center gap-1">
                                                    <AlertCircle className="h-3 w-3" />
                                                    {formErrors.securityQuestion}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label htmlFor="secretAnswer" className="flex items-center gap-2 text-gray-700 font-medium">
                                                <Shield className="h-4 w-4 text-blue-600" />
                                                Secret Answer
                                            </Label>
                                            <Input
                                                id="secretAnswer"
                                                name="secretAnswer"
                                                value={formData.secretAnswer}
                                                onChange={handleChange}
                                                className={`${formErrors.secretAnswer
                                                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                                                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                                                } transition-all duration-200`}
                                            />
                                            {formErrors.secretAnswer && (
                                                <p className="text-sm text-red-500 flex items-center gap-1">
                                                    <AlertCircle className="h-3 w-3" />
                                                    {formErrors.secretAnswer}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>

                    {isEditing && (
                        <CardFooter className="flex justify-end space-x-4 border-t p-6">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setFormData({ ...user });
                                    setIsEditing(false);
                                    setSelectedImage(null);
                                    setImagePreview(user.profileImage);
                                    setImageRemoved(false);
                                    setFormErrors({});
                                }}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleSubmit} disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Saving...
                                    </span>
                                ) : (
                                    'Save Changes'
                                )}
                            </Button>
                        </CardFooter>
                    )}
                </Card>
            </div>

            <ChangePasswordDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} userId={userData.id} email={userData.email} />
        </div>
    )
}

export default UserProfile