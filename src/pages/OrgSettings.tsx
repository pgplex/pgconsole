import { useParams } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function OrgSettings() {
  const { orgSlug } = useParams<{ orgSlug: string }>()

  return (
    <div className="flex-1 bg-white text-gray-900 overflow-auto">
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-2">Organization Settings</h1>
        <p className="text-gray-600 mb-8">
          Manage organization settings and preferences
        </p>

        <div className="space-y-6">
          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  placeholder="Enter organization name"
                  defaultValue={orgSlug}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-slug">Organization Slug</Label>
                <Input
                  id="org-slug"
                  placeholder="organization-slug"
                  defaultValue={orgSlug}
                  disabled
                />
                <p className="text-sm text-muted-foreground">
                  The slug cannot be changed after creation
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Members */}
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Manage organization members and their roles
              </p>
              <Button variant="outline">Manage Members</Button>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Delete Organization</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Once you delete an organization, there is no going back. Please be certain.
                  </p>
                  <Button variant="destructive">Delete Organization</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
