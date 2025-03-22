from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

class CountResponse(BaseModel):
    count: int

class QuestionnaireResponse(BaseModel):
    id: int
    questionnaire_id: int
    user_id: int
    session_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    answers: List["QuestionResponse"]

    class Config:
        from_attributes = True

class QuestionResponse(BaseModel):
    id: int
    questionnaire_response_id: int
    question_id: int
    answer: str
    created_at: datetime
    updated_at: datetime
    question: "Question"

    class Config:
        from_attributes = True

class Question(BaseModel):
    id: int
    questionnaire_id: int
    text: str
    type: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class User(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    role: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class Session(BaseModel):
    id: int
    name: str
    description: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class Questionnaire(BaseModel):
    id: int
    title: str
    description: str
    type: str
    created_at: datetime
    updated_at: datetime
    created_by_id: int

    class Config:
        from_attributes = True

class Answer(BaseModel):
    question_id: int
    answer: str

class Result(BaseModel):
    questionnaire_id: int
    answers: List[Answer]
    score: float
    date: str

class UserAnswer(BaseModel):
    user_id: int
    questionnaire_id: int
    answers: List[Answer]

class UserResult(BaseModel):
    user_id: int
    questionnaire_id: int
    result: Result

class UserQuestionnaire(BaseModel):
    user_id: int
    questionnaire_id: int
    status: str
    result: Result

class UserAnswerResult(BaseModel):
    user_id: int
    questionnaire_id: int
    answer: Answer
    result: Result

class UserQuestionnaireResult(BaseModel):
    user_id: int
    questionnaire_id: int
    result: Result

class UserQuestionnaireAnswer(BaseModel):
    user_id: int
    questionnaire_id: int
    answer: Answer

class UserQuestionnaireAnswerResult(BaseModel):
    user_id: int
    questionnaire_id: int
    answer: Answer
    result: Result 