"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, GitBranch, UserCheck, UserX } from "lucide-react";
import { findSimilarProfiles, type SupplierProfile, formatSerialNumber } from '../utils/fuzzy-matching';
import type { Customer as Supplier } from "@/lib/definitions";

interface SupplierGroupingInfoProps {
  selectedSupplier: Supplier | null;
  allSuppliers: Supplier[];
}

export const SupplierGroupingInfo: React.FC<SupplierGroupingInfoProps> = ({
  selectedSupplier,
  allSuppliers,
}) => {
  if (!selectedSupplier) return null;

  const selectedProfile: SupplierProfile = {
    name: selectedSupplier.name || '',
    fatherName: selectedSupplier.fatherName || '',
    address: selectedSupplier.address || '',
    contact: selectedSupplier.contact || '',
    srNo: selectedSupplier.srNo || '',
  };

  const similarProfiles = findSimilarProfiles(selectedProfile, 
    allSuppliers.map(s => ({
      name: s.name || '',
      fatherName: s.fatherName || '',
      address: s.address || '',
      contact: s.contact || '',
      srNo: s.srNo || '',
    }))
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          Fuzzy Profile Matching
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Exact Matches */}
        {similarProfiles.exact.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-600">Exact Matches</span>
              <Badge variant="secondary">{similarProfiles.exact.length}</Badge>
            </div>
            <div className="space-y-1">
              {similarProfiles.exact.map((supplier, index) => (
                <div key={index} className="text-sm text-gray-600 p-2 bg-green-50 rounded">
                  {supplier.name} - SR# {formatSerialNumber(supplier.srNo || '')}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Similar Matches */}
        {similarProfiles.similar.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-600">Similar Profiles</span>
              <Badge variant="secondary">{similarProfiles.similar.length}</Badge>
            </div>
            <div className="space-y-2">
              {similarProfiles.similar.map(({ profile, matchResult }, index) => (
                <div key={index} className="p-3 bg-blue-50 rounded border">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium">{profile.name}</div>
                      <div className="text-sm text-gray-600">
                        {profile.fatherName && `${profile.fatherName} - `}
                        {profile.address}
                      </div>
                      <div className="text-xs text-gray-500">SR# {formatSerialNumber(profile.srNo || '')}</div>
                    </div>
                    <Badge variant="outline">
                      {matchResult.totalDifference} chars diff
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-600">
                    <div>Name: {matchResult.fieldDifferences.name} chars</div>
                    <div>Father: {matchResult.fieldDifferences.fatherName} chars</div>
                    <div>Address: {matchResult.fieldDifferences.address} chars</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Matches */}
        {similarProfiles.exact.length === 0 && similarProfiles.similar.length === 0 && (
          <div className="flex items-center gap-2 text-gray-500">
            <UserX className="h-4 w-4" />
            <span>No similar profiles found</span>
          </div>
        )}

        {/* Profile Grouping Rules Info */}
        <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
          <div className="font-medium mb-1">Profile Grouping Rules:</div>
          <div>• <strong>Primary Rule:</strong> If Name, Father Name, and Address are identical → Same Profile</div>
          <div>• <strong>Secondary Rules:</strong> Maximum 2 character difference per field, 4 total difference</div>
          <div>• <strong>Fields Compared:</strong> Name, Father/Husband Name, Address</div>
          <div>• <strong>Result:</strong> Similar suppliers are grouped into single profiles</div>
        </div>
      </CardContent>
    </Card>
  );
};
