import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '../../../../../../../../lib/api';
import { withAuth } from '../../../../../../../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract and validate parameters
  const { id, responseId, questionId } = req.query;
  if (!id || Array.isArray(id) || !responseId || Array.isArray(responseId) || !questionId || Array.isArray(questionId)) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  try {
    // Apply auth middleware
    return withAuth(req, res, async (req, res) => {
      const token = req.cookies.token;
      
      try {
        // Save question response
        const data = await callBackendApi(
          `/questionnaires/${id}/responses/${responseId}/questions/${questionId}`,
          'POST',
          req.body,
          token
        );
        
        // Return the response from the backend
        return res.status(200).json(data);
      } catch (error: any) {
        console.error(`Error saving question response for questionnaire ${id}, response ${responseId}, question ${questionId}:`, error);
        
        // Handle specific error status codes
        if (error.response) {
          const { status, data } = error.response;
          
          // Handle validation errors (422)
          if (status === 422) {
            // If it's an array of errors, join them
            if (Array.isArray(data)) {
              return res.status(status).json({
                error: data.map(err => err.msg || err.message || err).join(', ')
              });
            }
            // If it's an object with a detail field that's an array
            if (data?.detail && Array.isArray(data.detail)) {
              const errorMessages = data.detail.map((err: { msg?: string; message?: string; loc?: string[] }) => {
                // If the error has a location field, include it in the message
                if (err.loc && err.loc.length > 0) {
                  const field = err.loc[err.loc.length - 1];
                  return `${field}: ${err.msg || err.message || err}`;
                }
                return err.msg || err.message || err;
              });
              return res.status(status).json({
                error: errorMessages.join(', ')
              });
            }
            // If it's an object with a detail field that's a string
            if (data?.detail && typeof data.detail === 'string') {
              return res.status(status).json({
                error: data.detail
              });
            }
            // If it's an object with a message field
            if (data?.message) {
              return res.status(status).json({
                error: data.message
              });
            }
            // If it's an object with an error field
            if (data?.error) {
              return res.status(status).json({
                error: data.error
              });
            }
            // Fallback for other validation errors
            return res.status(status).json({
              error: 'The provided data is invalid. Please check your input and try again.'
            });
          }
          
          // Handle other error status codes
          return res.status(status).json(data);
        }
        
        // Handle other errors
        return res.status(500).json({
          error: 'An error occurred while processing your request'
        });
      }
    });
  } catch (error) {
    console.error(`Unexpected error in save question response API:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 