import logging
import time
import json
import subprocess
from celery_app import celery_app
from celery import shared_task
from typing import Any, Dict, List, Optional, Union
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import AsyncSessionLocal
from models.questionnaire import QuestionnaireResponse, QuestionResponse, Question
from models.processors import Processor, ProcessingResult, InterpreterType
from datetime import datetime

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, track_started=True)
def process_interaction_batch(self, batch_id: int) -> Dict[str, Any]:
    logger.info(f"Processing interaction batch {batch_id}")
    
    # Simple logging of interaction data
    # No processing anymore
    
    return {
        "batch_id": batch_id,
        "processing_time": 0.0
    }

@celery_app.task(bind=True, track_started=True)
def process_questionnaire_response(self, response_id: int) -> Dict[str, Any]:
    """Process a questionnaire response with all assigned processors"""
    logger.info(f"Processing questionnaire response {response_id}")
    
    # Create async session
    async def process():
        async with AsyncSessionLocal() as session:
            # Get the questionnaire response
            result = await session.execute(
                select(QuestionnaireResponse)
                .where(QuestionnaireResponse.id == response_id)
            )
            questionnaire_response = result.scalar_one_or_none()
            
            if not questionnaire_response:
                logger.error(f"Questionnaire response {response_id} not found")
                return {"error": "Questionnaire response not found"}
            
            # Get the questionnaire
            questionnaire_id = questionnaire_response.questionnaire_id
            
            # Get all processors assigned to this questionnaire
            result = await session.execute(
                select(Processor)
                .join(Processor.questionnaires)
                .where(
                    (Processor.questionnaires.any(questionnaire_id=questionnaire_id)) &
                    (Processor.status == "active")
                )
            )
            processors = result.scalars().all()
            
            if not processors:
                logger.info(f"No active processors assigned to questionnaire {questionnaire_id}")
                return {"message": "No processors assigned"}
            
            # Get all question responses
            result = await session.execute(
                select(QuestionResponse)
                .where(QuestionResponse.questionnaire_response_id == response_id)
                .join(Question)
            )
            question_responses = result.scalars().all()
            
            # Process with each processor
            for processor in processors:
                # Check if already processed by this processor
                result = await session.execute(
                    select(ProcessingResult)
                    .where(
                        (ProcessingResult.questionnaire_response_id == response_id) &
                        (ProcessingResult.processor_id == processor.id)
                    )
                )
                existing_result = result.scalar_one_or_none()
                
                if existing_result and existing_result.status == "completed":
                    logger.info(f"Response {response_id} already processed by processor {processor.id}")
                    continue
                
                # Create or update processing result
                if not existing_result:
                    processing_result = ProcessingResult(
                        questionnaire_response_id=response_id,
                        processor_id=processor.id,
                        processor_version="deepseek-r1@v0.1",  # TODO: Make configurable
                        status="processing"
                    )
                    session.add(processing_result)
                    await session.flush()
                    result_id = processing_result.id
                else:
                    processing_result = existing_result
                    processing_result.status = "processing"
                    processing_result.updated_at = datetime.now()
                    result_id = processing_result.id
                
                await session.commit()
                
                # Queue the actual processing in a separate task
                execute_processor.delay(result_id)
            
            return {"message": f"Queued processing with {len(processors)} processors"}
    
    # Run the async function
    import asyncio
    return asyncio.run(process())

@celery_app.task(bind=True, track_started=True)
def execute_processor(self, result_id: int) -> Dict[str, Any]:
    """Execute a specific processor on a questionnaire response"""
    logger.info(f"Executing processor for result {result_id}")
    
    # Create async session
    async def process():
        async with AsyncSessionLocal() as session:
            # Get the processing result
            result = await session.execute(
                select(ProcessingResult)
                .where(ProcessingResult.id == result_id)
            )
            processing_result = result.scalar_one_or_none()
            
            if not processing_result:
                logger.error(f"Processing result {result_id} not found")
                return {"error": "Processing result not found"}
            
            # Get the processor
            result = await session.execute(
                select(Processor)
                .where(Processor.id == processing_result.processor_id)
            )
            processor = result.scalar_one_or_none()
            
            if not processor:
                logger.error(f"Processor {processing_result.processor_id} not found")
                processing_result.status = "failed"
                processing_result.error_message = "Processor not found"
                await session.commit()
                return {"error": "Processor not found"}
            
            # Get the questionnaire response
            result = await session.execute(
                select(QuestionnaireResponse)
                .where(QuestionnaireResponse.id == processing_result.questionnaire_response_id)
            )
            questionnaire_response = result.scalar_one_or_none()
            
            if not questionnaire_response:
                logger.error(f"Questionnaire response {processing_result.questionnaire_response_id} not found")
                processing_result.status = "failed"
                processing_result.error_message = "Questionnaire response not found"
                await session.commit()
                return {"error": "Questionnaire response not found"}
            
            # Get all question responses
            result = await session.execute(
                select(QuestionResponse)
                .where(QuestionResponse.questionnaire_response_id == processing_result.questionnaire_response_id)
                .join(Question)
            )
            question_responses = result.scalars().all()
            
            try:
                # Prepare the data for the processor
                questions_data = []
                for qr in question_responses:
                    questions_data.append({
                        "question_id": qr.question_id,
                        "question_text": qr.question.text,
                        "question_type": qr.question.type,
                        "answer": qr.answer
                    })
                
                # Format the prompt with the questionnaire data
                prompt_data = {
                    "questionnaire_id": questionnaire_response.questionnaire_id,
                    "user_id": questionnaire_response.user_id,
                    "questions": questions_data
                }
                
                # TODO: Call the actual API with the prompt
                # This is a placeholder for the actual API call
                output = f"Sample output for processor {processor.id} on response {processing_result.questionnaire_response_id}"
                
                # Store the raw output
                processing_result.raw_output = output
                
                # Apply post-processing if configured
                if processor.post_processing_code and processor.interpreter != InterpreterType.NONE:
                    processed_output = execute_post_processing(
                        processor.interpreter,
                        processor.post_processing_code,
                        output,
                        prompt_data
                    )
                    processing_result.processed_output = processed_output
                
                # Mark as completed
                processing_result.status = "completed"
                processing_result.updated_at = datetime.now()
                
            except Exception as e:
                logger.exception(f"Error processing result {result_id}: {str(e)}")
                processing_result.status = "failed"
                processing_result.error_message = str(e)
                processing_result.updated_at = datetime.now()
            
            await session.commit()
            
            return {
                "result_id": result_id,
                "status": processing_result.status
            }
    
    # Run the async function
    import asyncio
    return asyncio.run(process())

def execute_post_processing(interpreter: InterpreterType, code: str, output: str, prompt_data: Dict) -> Dict[Any, Any]:
    """Execute post-processing code in the specified interpreter"""
    if interpreter == InterpreterType.PYTHON:
        # Create a temporary Python script
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.py', mode='w', delete=False) as f:
            f.write(code)
            script_path = f.name
        
        try:
            # Prepare input data as JSON
            input_data = json.dumps({
                "output": output,
                "prompt_data": prompt_data
            })
            
            # Execute the script with the data as input
            result = subprocess.run(
                ['python', script_path],
                input=input_data.encode(),
                capture_output=True,
                text=True,
                check=True
            )
            
            # Parse the output as JSON and cast to Dict[Any, Any]
            python_result: Dict[Any, Any] = json.loads(result.stdout)
            return python_result
        except subprocess.CalledProcessError as e:
            logger.error(f"Post-processing script error: {e.stderr}")
            raise Exception(f"Post-processing failed: {e.stderr}")
        except json.JSONDecodeError:
            logger.error("Failed to parse post-processing output as JSON")
            raise Exception("Post-processing output is not valid JSON")
        finally:
            import os
            os.unlink(script_path)
    
    elif interpreter == InterpreterType.JAVASCRIPT:
        # Similar implementation for JavaScript using Node.js
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.js', mode='w', delete=False) as f:
            f.write(code)
            script_path = f.name
        
        try:
            # Prepare input data as JSON
            input_data = json.dumps({
                "output": output,
                "prompt_data": prompt_data
            })
            
            # Execute the script with the data as input
            result = subprocess.run(
                ['node', script_path],
                input=input_data.encode(),
                capture_output=True,
                text=True,
                check=True
            )
            
            # Parse the output as JSON and cast to Dict[Any, Any]
            js_result: Dict[Any, Any] = json.loads(result.stdout)
            return js_result
        except subprocess.CalledProcessError as e:
            logger.error(f"Post-processing script error: {e.stderr}")
            raise Exception(f"Post-processing failed: {e.stderr}")
        except json.JSONDecodeError:
            logger.error("Failed to parse post-processing output as JSON")
            raise Exception("Post-processing output is not valid JSON")
        finally:
            import os
            os.unlink(script_path)
    
    # Default case for other interpreter types
    return {}  # Return empty dict as fallback

@celery_app.task(bind=True, track_started=True)
def requeue_processing(self, response_id: int, processor_id: Optional[int] = None) -> Dict[str, Any]:
    """Requeue a questionnaire response for processing"""
    logger.info(f"Requeuing response {response_id} for processing")
    
    # Create async session
    async def process():
        async with AsyncSessionLocal() as session:
            # Get the questionnaire response
            result = await session.execute(
                select(QuestionnaireResponse)
                .where(QuestionnaireResponse.id == response_id)
            )
            questionnaire_response = result.scalar_one_or_none()
            
            if not questionnaire_response:
                logger.error(f"Questionnaire response {response_id} not found")
                return {"error": "Questionnaire response not found"}
            
            if processor_id:
                # Delete specific processing result if it exists
                result = await session.execute(
                    select(ProcessingResult)
                    .where(
                        (ProcessingResult.questionnaire_response_id == response_id) &
                        (ProcessingResult.processor_id == processor_id)
                    )
                )
                existing_result = result.scalar_one_or_none()
                
                if existing_result:
                    await session.delete(existing_result)
                    await session.commit()
            else:
                # Delete all processing results for this response
                result = await session.execute(
                    select(ProcessingResult)
                    .where(ProcessingResult.questionnaire_response_id == response_id)
                )
                existing_results = result.scalars().all()
                
                for existing_result in existing_results:
                    await session.delete(existing_result)
                
                await session.commit()
            
            # Queue for processing
            process_questionnaire_response.delay(response_id)
            
            return {"message": f"Requeued response {response_id} for processing"}
    
    # Run the async function
    import asyncio
    return asyncio.run(process())

@shared_task
def test_task(x: int) -> int:
    time.sleep(x)
    return x

