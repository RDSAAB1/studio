"use client";

import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, User, Phone, MapPin, UserSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Profile {
    name: string;
    so: string;
    address: string;
    contact: string;
}

interface ProfilesSearchDialogProps {
    profiles: Profile[];
    onSelect: (profile: Profile) => void;
    trigger?: React.ReactNode;
}

export function ProfilesSearchDialog({ profiles, onSelect, trigger }: ProfilesSearchDialogProps) {
    const [search, setSearch] = useState("");
    const [open, setOpen] = useState(false);

    const filteredProfiles = useMemo(() => {
        if (!search.trim()) return profiles.slice(0, 50);
        
        const term = search.toLowerCase();
        return profiles.filter(p => 
            p.name.toLowerCase().includes(term) ||
            p.so.toLowerCase().includes(term) ||
            p.address.toLowerCase().includes(term) ||
            p.contact.toLowerCase().includes(term)
        ).slice(0, 100);
    }, [profiles, search]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Search className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] p-0 gap-0">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                        <Search className="h-5 w-5 text-primary" />
                        Search Existing Suppliers
                    </DialogTitle>
                </DialogHeader>
                <div className="p-4 bg-muted/20">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Type Name, Phone or Address to search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-11 bg-background border-primary/20 focus-visible:ring-primary shadow-sm"
                            autoFocus
                        />
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground italic">
                        Tip: You can quickly find a supplier by typing their name or contact number.
                    </p>
                </div>
                <ScrollArea className="h-[400px]">
                    <div className="p-2 space-y-1">
                        {filteredProfiles.length > 0 ? (
                            filteredProfiles.map((p, i) => (
                                <div 
                                    key={i}
                                    className="flex flex-col p-3 rounded-md border border-transparent hover:border-primary/20 hover:bg-primary/5 cursor-pointer transition-all group"
                                    onClick={() => {
                                        onSelect(p);
                                        setOpen(false);
                                    }}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                {p.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                                                {p.name}
                                            </span>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] font-normal py-0">
                                            Profile
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-1 gap-x-4 ml-10 text-[11px] text-muted-foreground">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <UserSquare className="h-3 w-3 shrink-0" />
                                            <span className="truncate" title={p.so}>{p.so || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <Phone className="h-3 w-3 shrink-0" />
                                            <span className="font-mono">{p.contact || 'No Number'}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 min-w-0 sm:col-span-1">
                                            <MapPin className="h-3 w-3 shrink-0" />
                                            <span className="truncate" title={p.address}>{p.address || 'No Address'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center">
                                <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Search className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <p className="text-sm text-muted-foreground">No matching profiles found.</p>
                                <Button 
                                    variant="link" 
                                    className="text-xs text-primary mt-1"
                                    onClick={() => setSearch("")}
                                >
                                    Clear search and show all
                                </Button>
                            </div>
                        )}
                    </div>
                </ScrollArea>
                <div className="p-3 border-t bg-muted/10 text-center text-[10px] text-muted-foreground">
                    Showing {filteredProfiles.length} of {profiles.length} total profiles
                </div>
            </DialogContent>
        </Dialog>
    );
}
