import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FaceAuthComponent } from './face-auth/face-auth.component';

const routes: Routes = [
  {path: '',component: FaceAuthComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
