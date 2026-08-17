using System;
using System.IO;

string filePath = @"src\pages\ModuleAndAccess\Modals\ModifyWorkflowModal.tsx";
string content = File.ReadAllText(filePath);

content = content.Replace(
    "import { Trash2 } from 'lucide-react';",
    "import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';"
);

content = content.Replace(
    "  setPartiallyConfiguredStores?: (stores: Record<string, { configuredCount: number, totalCount: number }>) => void;\n  setStoreToDelete: (store: any) => void;",
    "  setPartiallyConfiguredStores?: (stores: Record<string, { configuredCount: number, totalCount: number }>) => void;\n  configuredUsersPerStore?: Record<string, string[]>;\n  handleInstantWorkflowToggle?: (userId: string, storeId: string, isChecked: boolean) => Promise<void>;\n  setStoreToDelete: (store: any) => void;"
);

content = content.Replace(
    "  partiallyConfiguredStores,\n  setPartiallyConfiguredStores,\n  setStoreToDelete,",
    "  partiallyConfiguredStores,\n  setPartiallyConfiguredStores,\n  configuredUsersPerStore,\n  handleInstantWorkflowToggle,\n  setStoreToDelete,"
);

string search1 = @"  const [isStoreSpecific, setIsStoreSpecific] = useState<boolean>(true);";
string replace1 = @"  const [isStoreSpecific, setIsStoreSpecific] = useState<boolean>(true);
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(new Set());

  const toggleUser = (userId: string) => {
    setExpandedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const isGroupView = !!(modifyWorkflowAction?.groupUsers && modifyWorkflowAction.groupUsers.length > 0);
  const isSingleUserView = !isGroupView && selectedRoles.length === 1 && filterUser && filterUser !== NONE && filterUser !== '__none__';
  const targetUsers = isGroupView ? modifyWorkflowAction.groupUsers : (isSingleUserView ? users.filter(u => u.id === filterUser) : users);";
content = content.Replace(search1, replace1);

// Now for the massive block
string search2 = @"                          <TableCell className=""whitespace-normal min-w-[300px]"">
                            <div className=""grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 py-2 w-full"">
                              {availableStores.map((store) => (
                                <div key={store.id} className=""flex items-start w-full"">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className=""flex items-start space-x-3 w-full"">
                                          {(() => {
                                            const isSingleUser = selectedRoles.length === 1 && filterUser && filterUser !== NONE;
                                            const isAllUsersInRole = selectedRoles.length === 1 && (!filterUser || filterUser === NONE);
                                            const isGroupView = !!(modifyWorkflowAction && modifyWorkflowAction.groupUsers && modifyWorkflowAction.groupUsers.length > 0);
                                            const isInherited = (isSingleUser && (storeScopeLevels[store.id]?.includes('Global') || storeScopeLevels[store.id]?.includes('Role'))) ||
                                              (isGroupView && (storeScopeLevels[store.id]?.includes('Global') || storeScopeLevels[store.id]?.includes('Role'))) ||
                                              (!isGroupView && isAllUsersInRole && storeScopeLevels[store.id]?.includes('Global'));
                                            const isReallyDisabled = store.isDisabled && !modifyWorkflowStores.includes(store.id);
                                            const isCheckboxDisabled = isReallyDisabled || isInherited;

                                            const isPartiallyConfigured = !!(partiallyConfiguredStores && partiallyConfiguredStores[store.id]);
                                            const isChecked = modifyWorkflowStores.includes(store.id);
                                            const checkState = isChecked ? true : (isPartiallyConfigured ? ""indeterminate"" : false);

                                            return (
                                              <>
                                                <Checkbox
                                                  id={store-}
                                                  checked={checkState}
                                                  disabled={isCheckboxDisabled}
                                                  className={mt-0.5 flex-shrink-0 }
                                                  onCheckedChange={(checked) => {
                                                    if (checked === true || checked === ""indeterminate"") {
                                                      setModifyWorkflowStores([...modifyWorkflowStores, store.id]);
                                                    } else {
                                                      if (storeScopeLevels[store.id] && storeScopeLevels[store.id].length > 0) {
                                                        setStoreToDelete({ id: store.id, label: store.label });
                                                      } else {
                                                        setModifyWorkflowStores(modifyWorkflowStores.filter(id => id !== store.id));
                                                      }
                                                    }
                                                  }}
                                                />
                                                <label
                                                  htmlFor={store-}
                                                  className={	ext-sm font-medium leading-snug cursor-pointer whitespace-normal break-words flex-1 flex items-center gap-1.5 }
                                                >
                                                  <span>{store.label}</span>
                                                  {isPartiallyConfigured && partiallyConfiguredStores && (
                                                    <TooltipProvider>
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <span className=""text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-md font-medium cursor-help whitespace-nowrap"">
                                                            ({partiallyConfiguredStores[store.id].configuredCount}/{partiallyConfiguredStores[store.id].totalCount} users)
                                                          </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                          <p className=""max-w-[200px] whitespace-normal"">This workflow is configured for a subset of users. Checking this will apply it to all users.</p>
                                                        </TooltipContent>
                                                      </Tooltip>
                                                    </TooltipProvider>
                                                  )}
                                                </label>
                                              </>
                                            );
                                          })()}
                                        </div>
                                      </TooltipTrigger>
                                      {store.isDisabled && !modifyWorkflowStores.includes(store.id) && (
                                        <TooltipContent>
                                          <p>The selected users do not have access to this store.</p>
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              ))}
                            </div>
                          </TableCell>";

string replace2 = @"                          <TableCell className=""whitespace-normal min-w-[300px] p-0"">
                            {targetUsers.length > 1 ? (
                              <div className=""w-full flex flex-col"">
                                {targetUsers.map((user: any) => {
                                  const isExpanded = expandedUserIds.has(user.id);
                                  const userConfiguredStoresCount = availableStores.filter(s => configuredUsersPerStore?.[s.id]?.includes(user.id)).length;
                                  
                                  return (
                                    <div key={user.id} className=""w-full border-b last:border-b-0"">
                                      <div 
                                        className=""flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors""
                                        onClick={() => toggleUser(user.id)}
                                      >
                                        <div className=""flex flex-col"">
                                          <span className=""font-medium text-slate-800"">{user.first_name} {user.last_name}</span>
                                          <span className=""text-xs text-slate-500"">{user.email || 'No email'}</span>
                                        </div>
                                        <div className=""flex items-center gap-3"">
                                          <span className=""text-xs font-medium bg-blue-50 text-blue-700 px-2 py-1 rounded-md"">
                                            {userConfiguredStoresCount} / {availableStores.length} stores
                                          </span>
                                          {isExpanded ? <ChevronUp className=""h-4 w-4 text-slate-400"" /> : <ChevronDown className=""h-4 w-4 text-slate-400"" />}
                                        </div>
                                      </div>
                                      
                                      {isExpanded && (
                                        <div className=""px-6 py-4 bg-slate-50/50 border-t border-slate-100"">
                                          <div className=""grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 w-full"">
                                            {availableStores.map((store) => {
                                              const isChecked = configuredUsersPerStore?.[store.id]?.includes(user.id) || false;
                                              const isInherited = storeScopeLevels[store.id]?.includes('Global') || storeScopeLevels[store.id]?.includes('Role');
                                              const isReallyDisabled = store.isDisabled && !isChecked;
                                              const isCheckboxDisabled = isReallyDisabled || isInherited;

                                              return (
                                                <div key={store.id} className=""flex items-start w-full"">
                                                  <Checkbox
                                                    id={user--store-}
                                                    checked={isChecked}
                                                    disabled={isCheckboxDisabled}
                                                    className={mt-0.5 flex-shrink-0 }
                                                    onCheckedChange={(checked) => {
                                                      if (handleInstantWorkflowToggle) {
                                                        handleInstantWorkflowToggle(user.id, store.id, checked === true);
                                                      }
                                                    }}
                                                  />
                                                  <label
                                                    htmlFor={user--store-}
                                                    className={	ext-sm font-medium leading-snug cursor-pointer whitespace-normal break-words flex-1 flex items-center gap-1.5 ml-3 }
                                                  >
                                                    {store.label}
                                                  </label>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className=""grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 p-4 w-full"">
                                {availableStores.map((store) => {
                                    const userId = targetUsers[0]?.id;
                                    const isPartiallyConfigured = !!(partiallyConfiguredStores && partiallyConfiguredStores[store.id]);
                                    const isChecked = userId && configuredUsersPerStore ? !!configuredUsersPerStore[store.id]?.includes(userId) : modifyWorkflowStores.includes(store.id);
                                    
                                    const checkState = isChecked ? true : (isPartiallyConfigured ? ""indeterminate"" : false);

                                    const isInherited = storeScopeLevels[store.id]?.includes('Global') || storeScopeLevels[store.id]?.includes('Role');
                                    const isReallyDisabled = store.isDisabled && !isChecked;
                                    const isCheckboxDisabled = isReallyDisabled || isInherited;

                                    return (
                                      <div key={store.id} className=""flex items-start w-full"">
                                        <Checkbox
                                          id={store-}
                                          checked={checkState}
                                          disabled={isCheckboxDisabled}
                                          className={mt-0.5 flex-shrink-0 }
                                          onCheckedChange={(checked) => {
                                            if (userId && handleInstantWorkflowToggle) {
                                               handleInstantWorkflowToggle(userId, store.id, checked === true);
                                            }
                                            
                                            if (checked === true || checked === ""indeterminate"") {
                                              setModifyWorkflowStores([...modifyWorkflowStores, store.id]);
                                            } else {
                                              if (storeScopeLevels[store.id] && storeScopeLevels[store.id].length > 0) {
                                                setStoreToDelete({ id: store.id, label: store.label });
                                              } else {
                                                setModifyWorkflowStores(modifyWorkflowStores.filter(id => id !== store.id));
                                              }
                                            }
                                          }}
                                        />
                                        <label
                                          htmlFor={store-}
                                          className={	ext-sm font-medium leading-snug cursor-pointer whitespace-normal break-words flex-1 flex items-center gap-1.5 ml-3 }
                                        >
                                          <span>{store.label}</span>
                                          {isPartiallyConfigured && partiallyConfiguredStores && (
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <span className=""text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-md font-medium cursor-help whitespace-nowrap"">
                                                    ({partiallyConfiguredStores[store.id].configuredCount}/{partiallyConfiguredStores[store.id].totalCount} users)
                                                  </span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p className=""max-w-[200px] whitespace-normal"">This workflow is configured for a subset of users. Checking this will apply it to all users.</p>
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          )}
                                        </label>
                                      </div>
                                    )
                                })}
                              </div>
                            )}
                          </TableCell>";

content = content.Replace(search2, replace2);
File.WriteAllText(filePath, content);
