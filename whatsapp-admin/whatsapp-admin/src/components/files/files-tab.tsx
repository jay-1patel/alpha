'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Upload, Search, Trash2, FileText, HelpCircle, X, Paperclip ,CalendarDays,ExternalLink,HardDrive,Layers3,Link2} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useKnowledgeFiles, useUploadFile, useDeleteFile } from '@/lib/hooks/useFiles'

interface KnowledgeFile {
  id: string
  fileName: string
  fileUrl: string
  module: string
  fileSize: number | null
  status: string
  uploadedAt: string
  isExternal: boolean
  showUrl: string
}

interface FilePermissions {
  upload_kb?: boolean
  upload_faq?: boolean
  delete_files?: boolean
}

interface FilesTabProps {
  permissions?: FilePermissions
}

export default function FilesTab({ permissions = {} }: FilesTabProps) {
  const canUploadKb = permissions.upload_kb === true
  const canUploadFaq = permissions.upload_faq === true
  const canDelete = permissions.delete_files === true
  const { data: files = [] } = useKnowledgeFiles()
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadModule, setUploadModule] = useState<'kb' | 'faq'>(canUploadKb ? 'kb' : 'faq')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({ name: '', percent: 0 })
  const [dragOver, setDragOver] = useState(false)
  const [attachedMedia, setAttachedMedia] = useState<{ name: string; url: string; media_type: string } | null>(null)
  const [mediaUploading, setMediaUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachInputRef = useRef<HTMLInputElement>(null)

  const uploadFile = useUploadFile()
  const deleteFile = useDeleteFile()

  const filteredFiles = files.filter(f => {
    const matchSearch = f.fileName.toLowerCase().includes(search.toLowerCase())
    const matchModule = moduleFilter === 'all' || f.module === moduleFilter
    return matchSearch && matchModule
  })

  const kbFiles = files.filter(f => f.module === 'kb')
  const faqFiles = files.filter(f => f.module === 'faq')

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const incoming = Array.from(fileList)
    const valid = incoming.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() || ''
      const allowed = ['pdf', 'txt', 'doc', 'docx', 'xlsx', 'xls']
      if (!allowed.includes(ext)) {
        toast.error(`Unsupported file type: ${f.name}`)
        return false
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`File too large: ${f.name}`)
        return false
      }
      return true
    })
    setSelectedFiles(prev => [...prev, ...valid])
  }

  const removeFile = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return
    setUploading(true)
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        setProgress({ name: file.name, percent: Math.round((i / selectedFiles.length) * 100) })
        const mediaUrl = attachedMedia?.url || undefined
        const mediaType = attachedMedia?.media_type || undefined
        await uploadFile.mutateAsync({ file, module: uploadModule, url: mediaUrl, mediaType })
      }
      setProgress({ name: '', percent: 100 })
      toast.success(`${selectedFiles.length} file(s) uploaded`)
      setSelectedFiles([])
      setAttachedMedia(null)
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      setProgress({ name: '', percent: 0 })
    }
  }

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMediaUploading(true)
    try {
      let res: { url: string; media_type?: string }
      if (file.type.startsWith('image/')) {
        res = await api.uploadImage(file)
      } else {
        res = await api.uploadCatbox(file)
      }
      setAttachedMedia({
        name: file.name,
        url: res.url,
        media_type: res.media_type || file.type || 'application/octet-stream',
      })
    } catch {
      toast.error('Attachment upload failed')
      setAttachedMedia(null)
    } finally {
      setMediaUploading(false)
      if (attachInputRef.current) attachInputRef.current.value = ''
    }
  }

  const handleDelete = async (fileName: string) => {
    deleteFile.mutate(fileName)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <FileText className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
          <p className="text-base text-muted-foreground">Manage knowledge base and FAQ documents</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-none shadow-md shadow-indigo-500/10 bg-gradient-to-br from-indigo-500 to-blue-600 text-white overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-white/80">Total KB Files</p>
              <p className="text-4xl font-bold mt-1">{kbFiles.length}</p>
              <p className="text-sm text-white/70 mt-1">Knowledge base documents</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-white/15 flex items-center justify-center">
              <FileText className="h-7 w-7" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md shadow-orange-500/10 bg-gradient-to-br from-amber-400 to-orange-500 text-white overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-white/80">Total FAQ Files</p>
              <p className="text-4xl font-bold mt-1">{faqFiles.length}</p>
              <p className="text-sm text-white/70 mt-1">FAQ documents uploaded</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-white/15 flex items-center justify-center">
              <HelpCircle className="h-7 w-7" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Section */}
      {(canUploadKb || canUploadFaq) && (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <CardTitle className="text-xl">Upload New File</CardTitle>
              <CardDescription className="text-base">Drag & drop or browse to upload PDF, DOC, TXT, XLS files</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border bg-muted p-0.5">
                {canUploadKb && (
                <button
                  onClick={() => setUploadModule('kb')}
                  className={`px-10 py-4 text-base font-medium rounded-md transition-colors ${uploadModule === 'kb'
                      ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  KB
                </button>
                )}
                {canUploadFaq && (
                <button
                  onClick={() => setUploadModule('faq')}
                  className={`px-10 py-4 text-base font-medium rounded-md transition-colors ${uploadModule === 'faq'
                      ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  FAQ
                </button>
                )}
              </div>
            </div>
          </div>

          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-blue-300 hover:border-blue-500'
              }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.doc,.docx,.xlsx,.xls"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Upload className="h-12 w-12 mx-auto mb-4 text-blue-400" />
            <p className="text-lg font-medium">Drag & Drop files here</p>
            <p className="text-base text-muted-foreground mt-1">or click to browse</p>
            <p className="text-sm text-muted-foreground mt-2">Max 10MB per file</p>
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && !uploading && (
            <div className="mt-4 space-y-2">
              <p className="text-base font-medium">Selected Files:</p>
              {selectedFiles.map((file, i) => (
                <div key={`${file.name}-${i}`} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-base truncate">{file.name}</span>
                  <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-blue-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button onClick={handleUpload} className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Upload {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}
              </Button>
            </div>
          )}

          {/* Progress */}
          {uploading && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-base mb-1">
                <span className="truncate">{progress.name}</span>
                <span>{progress.percent}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all duration-300" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
          )}

          {/* Attach Section */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <input ref={attachInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" className="hidden" onChange={handleAttach} />
              <Button variant="outline" onClick={() => attachInputRef.current?.click()} disabled={mediaUploading}>
                <Paperclip className="h-4 w-4 mr-2" />
                {mediaUploading ? 'Uploading...' : 'Attach'}
              </Button>
              {attachedMedia && (
                <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 bg-muted/30">
                  <span className="text-sm truncate max-w-[200px]">{attachedMedia.name}</span>
                  <button onClick={() => setAttachedMedia(null)} className="text-muted-foreground hover:text-blue-600">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-base text-muted-foreground mt-1">
              Attach a PDF or image used to send the pdf/image along with answer.
            </p>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Files Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl">All Files</CardTitle>
              <CardDescription className="text-base">List of all KB and FAQ files with module type</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input placeholder="Search files..." className="pl-10 w-[220px] h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger className="w-[160px] h-10">
                  <SelectValue placeholder="All Modules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  <SelectItem value="kb">KB Files</SelectItem>
                  <SelectItem value="faq">FAQ Files</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
  <CardContent className="p-4 sm:p-6">
  {filteredFiles.length === 0 ? (
    /* EMPTY STATE */
    <div className="flex min-h-[350px] flex-col items-center justify-center rounded-2xl border border-dashed bg-gradient-to-b from-muted/20 to-muted/5 px-4 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/10 bg-primary/10 shadow-sm">
        <FileText className="h-7 w-7 text-primary" />
      </div>

      <h3 className="text-lg font-semibold text-foreground">
        No files found
      </h3>

      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Upload a Knowledge Base or FAQ file to get started.
      </p>
    </div>
  ) : (
    /* TABLE CONTAINER */
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="max-h-[500px] overflow-auto">
        <Table>
          {/* HEADER */}
          <TableHeader className="sticky top-0 z-20 bg-muted/95 backdrop-blur-md">
            <TableRow className="border-b hover:bg-transparent">
              <TableHead className="h-12 min-w-[240px]">
                <div className="flex items-center gap-2 text-base font-semibold uppercase tracking-wider text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  File Name
                </div>
              </TableHead>

              <TableHead className="h-12 min-w-[130px]">
                <div className="flex items-center gap-2 text-base font-semibold uppercase tracking-wider text-muted-foreground">
                  <Layers3 className="h-4 w-4" />
                  Module
                </div>
              </TableHead>

              <TableHead className="h-12 min-w-[110px]">
                <div className="flex items-center gap-2 text-base font-semibold uppercase tracking-wider text-muted-foreground">
                  <HardDrive className="h-4 w-4" />
                  Size
                </div>
              </TableHead>

              <TableHead className="h-12 min-w-[260px]">
                <div className="flex items-center gap-2 text-base font-semibold uppercase tracking-wider text-muted-foreground">
                  <Link2 className="h-4 w-4" />
                  URL
                </div>
              </TableHead>

              <TableHead className="h-12 min-w-[190px]">
                <div className="flex items-center gap-2 text-base font-semibold uppercase tracking-wider text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  Uploaded
                </div>
              </TableHead>

              {canDelete && (
                <TableHead className="h-12 w-[90px] text-right">
                  <span className="text-base font-semibold uppercase tracking-wider text-muted-foreground">
                    Actions
                  </span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          {/* BODY */}
          <TableBody>
            {filteredFiles.map((file) => {
              const extension =
                file.fileName?.split(".").pop()?.toLowerCase() || "";

              return (
                <TableRow
                  key={file.id}
                  className="group border-b border-border/50 transition-colors hover:bg-muted/30"
                >
                  {/* FILE NAME */}
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      {/* File Icon */}
                      <div
                        className={`
                          flex h-10 w-10 shrink-0 items-center justify-center
                          rounded-xl border
                          ${
                            extension === "pdf"
                              ? "border-red-500/10 bg-red-500/10 text-red-600"
                              : extension === "csv"
                              ? "border-emerald-500/10 bg-emerald-500/10 text-emerald-600"
                              : extension === "txt"
                              ? "border-blue-500/10 bg-blue-500/10 text-blue-600"
                              : "border-primary/10 bg-primary/10 text-primary"
                          }
                        `}
                      >
                        <FileText className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <p
                          title={file.fileName}
                          className="max-w-[190px] truncate text-base font-semibold text-foreground"
                        >
                          {file.fileName}
                        </p>

                        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                          {extension || "FILE"}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  {/* MODULE */}
                  <TableCell className="py-4">
                    {file.module === "faq" ? (
                      <Badge
                        variant="outline"
                        className="border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-600 hover:bg-violet-500/10 dark:text-violet-400"
                      >
                        FAQ
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
                      >
                        {file.module.toUpperCase()}
                      </Badge>
                    )}
                  </TableCell>

                  {/* FILE SIZE */}
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>

                      <span className="whitespace-nowrap text-base font-medium text-muted-foreground">
                        {formatFileSize(file.fileSize)}
                      </span>
                    </div>
                  </TableCell>

                  {/* URL */}
                  <TableCell className="max-w-[300px] py-4">
                    {file.showUrl !== "-" ? (
                      <a
                        href={file.showUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={file.showUrl}
                        className="
                          group/link
                          inline-flex
                          max-w-[260px]
                          items-center
                          gap-2
                          rounded-lg
                          border border-blue-500/10
                          bg-blue-500/[0.06]
                          px-2.5 py-1.5
                          text-base
                          font-medium
                          text-blue-600
                          transition-colors
                          hover:border-blue-500/20
                          hover:bg-blue-500/10
                          dark:text-blue-400
                        "
                      >
                        <Link2 className="h-3.5 w-3.5 shrink-0" />

                        <span className="truncate">
                          {file.showUrl}
                        </span>

                        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60 transition-opacity group-hover/link:opacity-100" />
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 text-base text-muted-foreground">
                        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                        Not available
                      </div>
                    )}
                  </TableCell>

                  {/* UPLOADED DATE */}
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>

                      <div className="whitespace-nowrap">
                        <p className="text-small font-medium text-foreground">
                          {new Date(file.uploadedAt).toLocaleDateString()}
                        </p>

                        <p className="mt-0.5 text-[15px] text-muted-foreground">
                          {new Date(file.uploadedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  {/* ACTION */}
                  {canDelete && (
                    <TableCell className="py-4 text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete file"
                            className="
                              h-9 w-9
                              rounded-lg
                              text-muted-foreground
                              transition-colors
                              hover:bg-destructive/10
                              hover:text-destructive
                            "
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>

                        <AlertDialogContent className="sm:max-w-md">
                          <AlertDialogHeader>
                            {/* Delete Icon */}
                            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10">
                              <Trash2 className="h-5 w-5 text-destructive" />
                            </div>

                            <AlertDialogTitle>
                              Delete file?
                            </AlertDialogTitle>

                            <AlertDialogDescription>
                              Are you sure you want to delete{" "}
                              <span className="font-medium text-foreground">
                                &quot;{file.fileName}&quot;
                              </span>
                              ? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>

                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              Cancel
                            </AlertDialogCancel>

                            <AlertDialogAction
                              onClick={() =>
                                handleDelete(file.fileName)
                              }
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* FILE COUNT FOOTER */}
      <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />

          <span>
            <span className="font-semibold text-foreground">
              {filteredFiles.length}
            </span>{" "}
            {filteredFiles.length === 1 ? "file" : "files"}
          </span>
        </div>

        <span className="text-xs text-muted-foreground">
          Knowledge Base
        </span>
      </div>
    </div>
  )}
</CardContent>
      </Card>
    </div>
  )
}
