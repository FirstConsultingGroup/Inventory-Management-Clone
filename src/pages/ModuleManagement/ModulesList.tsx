import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Plus, Pencil, Trash2, Search, Filter, Component, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/Utils/types/supabaseClient";
import { loadModulePermissions } from "@/Utils/commonFun";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CustomizeListModal } from "./CustomizeListModal";
import toast from "react-hot-toast";


// import { GET_ALL_APPLICATIONS_API, GET_ALL_MODULES_API} from "@/Utils/Constants/Api";

interface ModuleItem {
  id: string;
  module_key: string;
  module_name: string;
  parent_id: string;
}

export const ModulesList = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterParentModule, setFilterParentModule] = useState("all");
  const [filterModuleType, setFilterModuleType] = useState("all");
   const ModuleTypeFilters = [
    { value: 'all', label: 'All Module Types' },
    { value: 'general', label: 'General' },
    { value: 'storeSpecific', label: 'Store Specific' }
  ];

  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [parentModules, setParentModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalModules, setTotalModules] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Permissions
  const [modulePermissions, setModulePermissions] = useState<any[]>([]);
  const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';

  useEffect(() => {
    fetchModules();
  }, [page, limit, searchQuery, filterParentModule, filterModuleType]);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');

    const fetchPermissions = async () => {
      const userId = userData?.user_id || userData?.employee_id;
      if (userId) {
        const res = await loadModulePermissions(appCode, 'Manage Modules', userId);
        if (res && res.permissions) {
          setModulePermissions(res.permissions);
        }
      }
    };
    fetchPermissions();
  }, [appCode]);

  const hasPermission = (actionName: string) => {
    const perm = modulePermissions.find((p: any) => p.action_id?.actionName?.toLowerCase() === actionName.toLowerCase());
    return perm ? perm.isAllowed : false;
  };

   const handleFilterReset = () => {
    setSearchQuery('');
    setFilterParentModule('all');
    setFilterModuleType('all');
    setLimit(10);
    setPage(1);
    toast.success('Filters cleared successfully!');
  };

  const fetchParentModules = async () => {
    try {
      const { data, error } = await supabase
        .from("parent_modules" as any)
        .select("*");

      if (error) {
        console.error("Error fetching parent modules:", error);
        return;
      }

      setParentModules(data || []);
    } catch (error) {
      console.error("Failed to fetch parent modules", error);
    }
  };
  useEffect(() => {
    fetchParentModules();
  }, []);

  const fetchModules = async () => {
    setLoading(true);

    const currentPage = page;

    try {
      const startIndex = (currentPage - 1) * limit;
      const endIndex = startIndex + limit - 1;

      let query = supabase
        .from("main_modules" as any)
        .select("*", { count: "exact" });

      if (searchQuery.trim()) {
        query = query.or(
          `module_name.ilike.%${searchQuery}%,module_key.ilike.%${searchQuery}%`
        );
      }

      if (filterParentModule !== "all") {
        query = query.eq("parent_id", filterParentModule);
      }

      if(filterModuleType !=="all") {
        query = query.eq("is_store_specific", filterModuleType === "storeSpecific");
      }

      query = query.range(startIndex, endIndex);

      const { data, error, count } = await query;

      if (error) {
        console.error(error);
        return;
      }

      // only update latest page
      if (currentPage === page) {
        setModules((data as unknown as ModuleItem[]) || []);
        setTotalModules(count || 0);
        setTotalPages(Math.ceil((count || 0) / limit));
      }
      console.log("PAGE", page);
      console.log("TOTAL PAGES", totalPages);
    } catch (error) {
      console.error("Failed to fetch modules", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="min-h-[85vh] shadow-sm">
          <CardHeader className="rounded-t-lg border-b pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-blue-100 shadow-sm">
                  <Component className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    Manage Modules
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Manage your modules here.
                  </CardDescription>
                </div>
              </div>

              <div className="flex gap-2">
                <div>
                  <CustomizeListModal parentModules={parentModules} />
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <Button
                          onClick={() => navigate('/dashboard/module-management/add')}
                          className="transition-colors cursor-pointer"
                          disabled={!hasPermission('Add')}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Module
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!hasPermission('Add') && (
                      <TooltipContent>
                        <p>You don't have permission to perform this action.</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="mb-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search modules..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <Select value={filterParentModule} onValueChange={(value) => {
                    setFilterParentModule(value);
                    setPage(1);
                  }}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Parent Modules" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Parent Modules</SelectItem>
                      {parentModules.map(parent => (
                        <SelectItem key={parent.id} value={parent.id}>{parent.module_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterModuleType} onValueChange={(value) => {
                    setFilterModuleType(value);
                    setPage(1);
                  }}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Module Types" />
                    </SelectTrigger>
                    <SelectContent>
                      {ModuleTypeFilters.map((type,index) => (
                        <SelectItem key={index} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                                    variant="outline"
                                    onClick={handleFilterReset}
                                    className="transition-colors w-full sm:w-auto"
                                    disabled={loading}
                                  >
                                    Clear Filters
                                  </Button>
              </div>
            </div>

            <div className="rounded-lg overflow-hidden border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-gray-50 border-gray-200">
                    <TableHead className="font-semibold">SI.NO.</TableHead>
                    <TableHead className="font-semibold">Module Key</TableHead>
                    <TableHead className="font-semibold">Label</TableHead>
                    <TableHead className="font-semibold">Parent Module</TableHead>
                    <TableHead className="text-center font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    Array(limit).fill(0).map((_, index) => (
                                            <TableRow key={index} className="hover:bg-gray-50">
                                              <TableCell className="py-3"><div className="h-6 w-32 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                              <TableCell><div className="h-6 w-65 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                              <TableCell><div className="h-6 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                              <TableCell><div className="h-6 w-25 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                              <TableCell className="text-center">
                                                <div className="flex justify-center gap-2">
                                                  <div className="h-6 w-8 bg-gray-200 rounded animate-pulse"></div>
                                                  <div className="h-6 w-8 bg-gray-200 rounded animate-pulse"></div>
                                                  <div className="h-6 w-8 bg-gray-200 rounded animate-pulse"></div>
                                                </div>
                                              </TableCell>
                                            </TableRow>
                                          ))
                  ) : modules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-indigo-600 font-medium">
                        No modules found
                      </TableCell>
                    </TableRow>
                  ) : (
                    modules.map((module, index) => (
                      <TableRow key={module.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">
                          <p className="ps-1">{(page - 1) * limit + index + 1}</p>
                        </TableCell>
                        <TableCell className="font-medium">
                          {module.module_key}
                        </TableCell>
                        <TableCell className="min-w-[180px] whitespace-normal break-words">
                          {module.module_name}
                        </TableCell>
                        <TableCell>
                          {
                            parentModules.find(
                              (parent) => parent.id === module.parent_id
                            )?.module_name || "-"
                          }
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-block">
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="rounded-lg"
                                      onClick={() => navigate(`/dashboard/module-management/edit/${module.id}`)}
                                      disabled={!hasPermission('Edit')}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                {!hasPermission('Edit') && (
                                  <TooltipContent>
                                    <p>You don't have permission to perform this action.</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-block">
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="rounded-lg text-red-500 hover:text-red-600"
                                      disabled={!hasPermission('Delete')}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                {!hasPermission('Delete') && (
                                  <TooltipContent>
                                    <p>You don't have permission to perform this action.</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-6 gap-4">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  Show
                </p>
                <Select
                  value={limit.toString()}
                  onValueChange={(value) => {
                    setLimit(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[70px]">
                    <SelectValue placeholder={limit.toString()} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  entries
                </p>
              </div>

              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Showing {totalModules > 0 ? ((page - 1) * limit) + 1 : 0} to {Math.min(page * limit, totalModules)} of {totalModules} entries
                </p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                    disabled={loading || page === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center justify-center text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                    Page {page} of {totalPages || 1}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.min(prev + 1, totalPages || 1))}
                    disabled={loading || page >= totalPages || totalPages === 0}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

