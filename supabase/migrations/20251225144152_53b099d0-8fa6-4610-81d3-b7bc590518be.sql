-- Create detection_history table
CREATE TABLE public.detection_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT,
  disease_name TEXT NOT NULL,
  confidence DECIMAL(5,2) NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.detection_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own detection history
CREATE POLICY "Users can view their own detection history"
ON public.detection_history
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own detection history
CREATE POLICY "Users can insert their own detection history"
ON public.detection_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own detection history
CREATE POLICY "Users can delete their own detection history"
ON public.detection_history
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view all detection history
CREATE POLICY "Admins can view all detection history"
ON public.detection_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Create index for faster queries
CREATE INDEX idx_detection_history_user_id ON public.detection_history(user_id);
CREATE INDEX idx_detection_history_created_at ON public.detection_history(created_at DESC);